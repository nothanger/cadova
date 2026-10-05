#!/usr/bin/env python3
"""Inspect or deploy Cadova's private quote import and initial email delivery.

Use SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from a secure terminal.
Requires the existing quote followup deployment through migration 0010.
Deployment does not create a user, send email, or enable quote followups.
"""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from edge_bundle import FUNCTION_ROOT, function_sources


class DeploymentError(Exception):
    pass


def request_json(url, headers, method="GET", body=None, raw=None):
    payload = json.dumps(body).encode() if body is not None else raw
    request_headers = dict(headers)
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        # Neither management errors nor SQL/provider response bodies are safe
        # to display: they can contain private inputs or credentials.
        raise DeploymentError(f"HTTP {error.code} during {method} {urllib.parse.urlsplit(url).path}") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise DeploymentError(f"Request failed during {method} {urllib.parse.urlsplit(url).path}") from None


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def verify_unauthenticated_actions(endpoint):
    """Exercise both handler entrypoints without authorizing cleanup or email."""
    bodies = (
        {"action": "cleanup"},
        {
            "action": "send", "quoteId": "00000000-0000-0000-0000-000000000000",
            "recipientEmail": "test@example.com", "subject": "Authentication check",
            "message": "This request must be rejected before any send request.",
        },
    )
    for body in bodies:
        for attempt in range(5):
            request = urllib.request.Request(
                endpoint, data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"}, method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=30):
                    pass
            except urllib.error.HTTPError as error:
                try:
                    result = json.loads(error.read(4096))
                except (ValueError, UnicodeDecodeError):
                    result = {}
                if error.code == 401 and isinstance(result, dict) and result.get("errorCode") == "unauthorized":
                    break
            except (urllib.error.URLError, TimeoutError):
                pass
            if attempt < 4:
                time.sleep(2)
        else:
            raise DeploymentError("The deployed document handler did not reject unauthenticated actions as expected.")


def scheduler_sql(ref, crypto_schema):
    # Identifiers must be constrained before interpolation; endpoint is a SQL
    # literal. The permanent credential never leaves Vault in a queued request.
    if not re.fullmatch(r"[a-z0-9]{20}", ref) or not re.fullmatch(r"[a-z_][a-z0-9_]*", crypto_schema):
        raise DeploymentError("Unsupported project reference or pgcrypto schema.")
    endpoint = sql_literal(f"https://{ref}.supabase.co/functions/v1/send-quote-document")
    return """
      begin;
      create or replace function public.dispatch_quote_document_cleanup() returns bigint
      language plpgsql security definer set search_path='' as $$
      declare credential text; request_id bigint; issued text; nonce text; proof text;
      begin
        select decrypted_secret into strict credential from vault.decrypted_secrets
          where name='cadova_quote_followup_scheduler_secret';
        if credential is null or length(credential)<32 then
          raise exception 'Scheduler credential unavailable.';
        end if;
        issued:=floor(extract(epoch from clock_timestamp()))::bigint::text;
        nonce:=gen_random_uuid()::text;
        proof:='cadova-documents-v1:'||issued||':'||nonce||':'||encode(""" + crypto_schema + """.hmac('quote-documents-cleanup:'||issued||':'||nonce,credential,'sha256'),'hex');
        select net.http_post(
          url=>""" + endpoint + """,
          headers=>jsonb_build_object('Authorization','Bearer '||proof,'Content-Type','application/json'),
          body=>'{"action":"cleanup"}'::jsonb,
          timeout_milliseconds=>120000
        ) into request_id;
        return request_id;
      end;
      $$;
      revoke all on function public.dispatch_quote_document_cleanup() from public,anon,authenticated,service_role;
      select cron.unschedule(jobid) from cron.job where jobname='cadova-quote-documents-cleanup';
      select cron.schedule('cadova-quote-documents-cleanup','17 * * * *','select public.dispatch_quote_document_cleanup();');
      commit;
    """


def deploy(mode):
    access_token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    if not access_token or not re.fullmatch(r"[a-z0-9]{20}", ref):
        raise DeploymentError("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF securely.")
    management = f"https://api.supabase.com/v1/projects/{ref}"
    authorization = {"Authorization": f"Bearer {access_token}"}
    project = request_json(management, authorization)
    if project.get("status") != "ACTIVE_HEALTHY":
        raise DeploymentError("The selected Supabase project is not active and healthy.")
    stage = "inspection"

    def query(sql):
        try:
            return request_json(f"{management}/database/query", authorization, "POST", {"query": sql})
        except DeploymentError as error:
            raise DeploymentError(f"{stage}: {error}") from None

    prerequisites = query("""
      select to_regclass('public.companies') is not null as companies,
        to_regclass('public.quotes') is not null as quotes,
        to_regclass('public.quote_events') is not null as quote_events,
        to_regclass('public.company_email_settings') is not null as email_settings,
        to_regclass('public.quote_followup_service_state') is not null as email_service,
        to_regclass('public.quote_followup_scheduler_nonces') is not null as scheduler_auth,
        to_regclass('storage.buckets') is not null as storage_buckets,
        to_regclass('storage.objects') is not null as storage_objects,
        to_regclass('vault.decrypted_secrets') is not null as vault,
        to_regclass('cron.job') is not null as scheduler;
    """)[0]
    checks_sql = """
      select to_regclass('public.quote_documents') is not null as documents,
        to_regclass('public.quote_initial_send_jobs') is not null as initial_send_jobs,
        to_regclass('public.quote_initial_send_payloads') is not null as private_payloads,
        to_regclass('public.quote_document_cleanup') is not null as cleanup,
        to_regclass('public.quote_document_cleanup_nonces') is not null as cleanup_nonces,
        to_regprocedure('public.save_imported_quote(uuid,uuid,uuid,jsonb,text,bigint,text,boolean,date,date,jsonb)') is not null as import_rpc,
        to_regprocedure('public.attach_quote_document(uuid,jsonb)') is not null as attach_rpc,
        to_regprocedure('public.request_quote_initial_send(uuid,text,text,text,boolean)') is not null as send_rpc,
        to_regprocedure('public.cancel_quote_initial_send(uuid)') is not null as cancel_rpc,
        to_regprocedure('public.claim_quote_initial_send(uuid,uuid,integer)') is not null as claim_rpc,
        to_regprocedure('public.persist_quote_initial_payload(uuid,uuid,jsonb,text)') is not null as payload_rpc,
        to_regprocedure('public.record_quote_initial_acceptance(uuid,uuid,text)') is not null as acceptance_rpc,
        to_regprocedure('public.complete_quote_initial_send(uuid,uuid,text)') is not null as complete_send_rpc,
        to_regprocedure('public.fail_quote_initial_send(uuid,uuid,text,boolean)') is not null as fail_send_rpc,
        to_regprocedure('public.claim_quote_document_cleanup(integer,integer)') is not null as claim_cleanup_rpc,
        to_regprocedure('public.complete_quote_document_cleanup(uuid,uuid)') is not null as complete_cleanup_rpc,
        to_regprocedure('public.fail_quote_document_cleanup(uuid,uuid)') is not null as fail_cleanup_rpc,
        to_regprocedure('public.consume_quote_document_cleanup_nonce(uuid,bigint)') is not null as cleanup_nonce_rpc;
    """
    checks = query(checks_sql)[0]
    secret_names = {item["name"] for item in request_json(f"{management}/secrets", authorization)}
    required_secrets = {"RESEND_API_KEY", "RESEND_FROM", "QUOTE_FOLLOWUP_EMAIL_ENABLED", "QUOTE_FOLLOWUP_SCHEDULER_SECRET"}
    scheduler_query = """
      select jobname,schedule,active from cron.job where jobname='cadova-quote-documents-cleanup';
    """
    if mode == "inspect":
        functions = request_json(f"{management}/functions", authorization)
        return {
            "project_ref": ref, "status": project["status"],
            "prerequisites": prerequisites, "checks": checks,
            "worker_deployed": any(item.get("slug") == "send-quote-document" for item in functions),
            "missing_secret_names": sorted(required_secrets - secret_names),
            "cleanup_scheduler": query(scheduler_query) if prerequisites["scheduler"] else [],
        }
    if not all(prerequisites.values()):
        raise DeploymentError("Deploy the existing Cadova migrations and quote followup scheduler through 0010 first.")
    if any(checks.values()) and not all(checks.values()):
        raise DeploymentError("The document schema is incomplete. Inspect and repair the partial migration before deployment.")

    root = Path(__file__).resolve().parents[1]
    sources = sorted(function_sources("send-quote-document"))
    if not {"index.ts", "handler.ts", "validation.ts"}.issubset(source.name for source in sources):
        raise DeploymentError("The quote document worker sources are incomplete.")
    migration = (root / "supabase/migrations/0011_quote_documents.sql").read_text()

    stage = "private scheduler credential"
    privileges = query("""
      select role,has_schema_privilege(role,'vault','USAGE') as schema_usage,
        has_table_privilege(role,'vault.secrets','SELECT') as secret_read,
        has_table_privilege(role,'vault.decrypted_secrets','SELECT') as decrypted_read
      from unnest(array['anon','authenticated']) as role;
    """)
    if any(value for row in privileges for key, value in row.items() if key != "role"):
        raise DeploymentError("Frontend roles must not have access to scheduler secrets.")
    stored = query("select decrypted_secret from vault.decrypted_secrets where name='cadova_quote_followup_scheduler_secret';")
    if len(stored) != 1:
        raise DeploymentError("The existing quote followup scheduler Vault secret must be present and unique.")
    scheduler_secret = stored[0]["decrypted_secret"]
    if not isinstance(scheduler_secret, str) or not 32 <= len(scheduler_secret) <= 512 or any(char.isspace() for char in scheduler_secret):
        raise DeploymentError("The existing scheduler Vault secret is invalid; repair it before deployment.")
    crypto = query("select extnamespace::regnamespace::text as schema from pg_extension where extname='pgcrypto';")
    if len(crypto) != 1:
        raise DeploymentError("Install the pgcrypto extension before deployment.")
    schedule_install = scheduler_sql(ref, crypto[0]["schema"])

    if not all(checks.values()):
        stage = "document migration"
        query("begin;\n" + migration + "\ncommit;")
    if not all(query(checks_sql)[0].values()):
        raise DeploymentError("The document migration did not install all required objects.")
    bucket = query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='quote-documents';")
    if len(bucket) != 1 or bucket[0]["public"] or bucket[0]["file_size_limit"] != 10485760 or bucket[0]["allowed_mime_types"] != ["application/pdf"]:
        raise DeploymentError("The quote document bucket must be private and restricted to PDFs of at most 10 MiB.")
    protected = query("""
      select role,
        has_table_privilege(role,'public.quote_documents','INSERT,UPDATE,DELETE') as can_write_documents,
        has_table_privilege(role,'public.quote_initial_send_jobs','INSERT,UPDATE,DELETE') as can_write_send_jobs,
        has_table_privilege(role,'public.quote_initial_send_payloads','SELECT,INSERT,UPDATE,DELETE') as can_access_payloads,
        has_table_privilege(role,'public.quote_document_cleanup','SELECT,INSERT,UPDATE,DELETE') as can_access_cleanup,
        has_function_privilege(role,'public.claim_quote_initial_send(uuid,uuid,integer)','EXECUTE') as can_claim_send,
        has_function_privilege(role,'public.persist_quote_initial_payload(uuid,uuid,jsonb,text)','EXECUTE') as can_persist_payload,
        has_function_privilege(role,'public.record_quote_initial_acceptance(uuid,uuid,text)','EXECUTE') as can_record_acceptance,
        has_function_privilege(role,'public.complete_quote_initial_send(uuid,uuid,text)','EXECUTE') as can_complete_send,
        has_function_privilege(role,'public.fail_quote_initial_send(uuid,uuid,text,boolean)','EXECUTE') as can_fail_send,
        has_function_privilege(role,'public.claim_quote_document_cleanup(integer,integer)','EXECUTE') as can_claim_cleanup,
        has_function_privilege(role,'public.consume_quote_document_cleanup_nonce(uuid,bigint)','EXECUTE') as can_consume_nonce
      from unnest(array['anon','authenticated']) as role;
    """)
    if any(value for row in protected for key, value in row.items() if key != "role"):
        raise DeploymentError("Frontend roles must not write delivery results or access private worker operations.")
    rls = query("""
      select bool_and(relrowsecurity) as enabled from pg_class
      where oid in ('public.quote_documents'::regclass,'public.quote_initial_send_jobs'::regclass,
        'public.quote_initial_send_payloads'::regclass,'public.quote_document_cleanup'::regclass,
        'public.quote_document_cleanup_nonces'::regclass);
    """)
    if len(rls) != 1 or not rls[0]["enabled"]:
        raise DeploymentError("The quote document tables must keep row level security enabled.")

    # Reuse the credential already used by the followup scheduler. No sender
    # configuration or email-enabled flag is changed by this deployment.
    stage = "worker deployment"
    request_json(f"{management}/secrets", authorization, "POST", [
        {"name": "QUOTE_FOLLOWUP_SCHEDULER_SECRET", "value": scheduler_secret},
    ])
    boundary = "cadova-documents-" + secrets.token_hex(20)
    metadata = {"name": "send-quote-document", "entrypoint_path": "send-quote-document/index.ts", "verify_jwt": False}
    chunks = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'.encode(),
        json.dumps(metadata).encode(), b"\r\n",
    ]
    for source in sources:
        chunks.extend([
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{source.relative_to(FUNCTION_ROOT).as_posix()}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode(),
            source.read_bytes(), b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    deployed = request_json(
        f"{management}/functions/deploy?slug=send-quote-document",
        {**authorization, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        "POST", raw=b"".join(chunks),
    )
    verify_unauthenticated_actions(f"https://{ref}.supabase.co/functions/v1/send-quote-document")

    stage = "cleanup scheduler installation"
    query(schedule_install)
    scheduler = query(scheduler_query)
    if len(scheduler) != 1 or not scheduler[0]["active"] or scheduler[0]["schedule"] != "17 * * * *":
        raise DeploymentError("The document cleanup scheduler was not installed correctly.")
    restricted = query("""
      select role,has_function_privilege(role,'public.dispatch_quote_document_cleanup()','EXECUTE') as can_dispatch
      from unnest(array['anon','authenticated','service_role']) as role;
    """)
    if any(row["can_dispatch"] for row in restricted):
        raise DeploymentError("Only database administration may dispatch document cleanup.")
    return {
        "status": "deployed", "project_ref": ref,
        "function_status": deployed.get("status"), "bucket_private": True,
        "unauthenticated_actions_rejected": True,
        "cleanup_scheduler_ready": True, "cleanup_schedule": "17 * * * *",
        "missing_email_secret_names": sorted(required_secrets - {"QUOTE_FOLLOWUP_SCHEDULER_SECRET"} - secret_names),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--inspect", action="store_true", help="Read project readiness without writing")
    group.add_argument("--deploy", action="store_true", help="Install the private quote schema, worker and hourly cleanup")
    args = parser.parse_args()
    try:
        print(json.dumps(deploy("inspect" if args.inspect else "deploy")))
    except DeploymentError as error:
        print(json.dumps({"status": "failed", "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
