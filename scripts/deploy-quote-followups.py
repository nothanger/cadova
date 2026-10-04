#!/usr/bin/env python3
"""Inspect or deploy Cadova's opt-in quote email automation.

Use SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from a secure terminal.
Sender credentials belong in Supabase Edge Function Secrets, never in Git.
Deployment installs the migration, private worker and five-minute scheduler.
It does not enable email, activate quotes or send a test email.
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
        # SQL and provider responses can contain secrets. Never echo their bodies.
        raise DeploymentError(f"HTTP {error.code} during {method} {urllib.parse.urlsplit(url).path}") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise DeploymentError(f"Request failed during {method} {urllib.parse.urlsplit(url).path}") from None


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


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

    checks = query("""
      select to_regclass('public.companies') is not null as companies,
        to_regclass('public.quotes') is not null as quotes,
        to_regclass('public.quote_events') is not null as quote_events,
        to_regprocedure('public.admin_create_company(text,uuid)') is not null as admin_companies,
        to_regclass('public.quote_followup_jobs') is not null as automation,
        to_regclass('public.quote_followup_scheduler_nonces') is not null as scheduler_auth;
    """)[0]
    secret_names = {item["name"] for item in request_json(f"{management}/secrets", authorization)}
    required_email = {"RESEND_API_KEY", "RESEND_FROM", "QUOTE_FOLLOWUP_EMAIL_ENABLED"}
    if mode == "inspect":
        functions = request_json(f"{management}/functions", authorization)
        return {
            "project_ref": ref, "status": project["status"], "checks": checks,
            "worker_deployed": any(item.get("slug") == "send-quote-followups" for item in functions),
            "missing_email_secret_names": sorted(required_email - secret_names),
            "email_service": query("select enabled,configured,status_code from public.quote_followup_service_state where id;") if checks["automation"] else None,
        }
    if not all(checks[key] for key in ("companies", "quotes", "quote_events", "admin_companies")):
        raise DeploymentError("Apply the existing Cadova migrations through 0008 first.")
    mismatches = query("""
      select count(*) as count from public.quote_events e
      join public.quotes q on q.id=e.quote_id where e.company_id<>q.company_id;
    """)[0]["count"]
    if mismatches:
        raise DeploymentError("Resolve existing quote events with mismatched companies before deployment.")
    root = Path(__file__).resolve().parents[1]
    if not checks["automation"]:
        stage = "migration"
        migration = (root / "supabase/migrations/0009_quote_email_automation.sql").read_text()
        query("begin;\n" + migration + "\ncommit;")
    if not checks["scheduler_auth"]:
        stage = "one-time scheduler authentication"
        migration = (root / "supabase/migrations/0010_quote_followup_scheduler_auth.sql").read_text()
        query("begin;\n" + migration + "\ncommit;")

    stage = "scheduler extensions and permissions"
    query("""
      create extension if not exists pg_cron with schema pg_catalog;
      create extension if not exists pg_net with schema extensions;
      create extension if not exists pgcrypto with schema extensions;
      -- Supabase owns pg_net and its ACLs. Queue headers contain only a signed,
      -- short-lived, one-time proof, never the permanent Vault credential.
      revoke all on all tables in schema vault from public,anon,authenticated;
      revoke all on all sequences in schema vault from public,anon,authenticated;
      -- Vault's managed crypto functions retain their extension-owned ACLs.
      -- Frontend roles cannot reach them without schema usage or read secrets.
      revoke all on schema vault from public,anon,authenticated;
    """)
    vault_privileges = query("""
      select role,has_schema_privilege(role,'vault','USAGE') as schema_usage,
        has_table_privilege(role,'vault.secrets','SELECT') as secret_read,
        has_table_privilege(role,'vault.decrypted_secrets','SELECT') as decrypted_read
      from unnest(array['anon','authenticated']) as role;
    """)
    if any(value for row in vault_privileges for key, value in row.items() if key != "role"):
        raise DeploymentError("Frontend roles must not have access to scheduler secrets.")
    crypto_schema = query("select extnamespace::regnamespace::text as schema from pg_extension where extname='pgcrypto';")[0]["schema"]
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", crypto_schema):
        raise DeploymentError("The pgcrypto extension schema is unsupported.")
    stage = "private scheduler credential"
    vault_name = "cadova_quote_followup_scheduler_secret"
    stored = query("select id,decrypted_secret from vault.decrypted_secrets where name=" + sql_literal(vault_name) + ";")
    if len(stored) > 1:
        raise DeploymentError("The scheduler Vault secret name must be unique.")
    scheduler_secret = stored[0]["decrypted_secret"] if stored else secrets.token_urlsafe(48)
    if not isinstance(scheduler_secret, str) or len(scheduler_secret) < 32 or any(char.isspace() for char in scheduler_secret):
        raise DeploymentError("The existing scheduler Vault secret is invalid; repair it before deployment.")
    updates = [{"name": "QUOTE_FOLLOWUP_SCHEDULER_SECRET", "value": scheduler_secret}]
    if "QUOTE_FOLLOWUP_EMAIL_ENABLED" not in secret_names:
        updates.append({"name": "QUOTE_FOLLOWUP_EMAIL_ENABLED", "value": "false"})
    request_json(f"{management}/secrets", authorization, "POST", updates)
    if not stored:
        query("select vault.create_secret(" + sql_literal(scheduler_secret) + "," + sql_literal(vault_name) + ",'Private quote followup scheduler credential');")

    boundary = "cadova-" + secrets.token_hex(20)
    metadata = {"name": "send-quote-followups", "entrypoint_path": "index.ts", "verify_jwt": False}
    chunks = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'.encode(),
        json.dumps(metadata).encode(), b"\r\n",
    ]
    for source in sorted((root / "supabase/functions/send-quote-followups").glob("*.ts")):
        chunks.extend([
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{source.name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode(),
            source.read_bytes(), b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    deployed = request_json(
        f"{management}/functions/deploy?slug=send-quote-followups",
        {**authorization, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        "POST", raw=b"".join(chunks),
    )

    # Only database administration can invoke this dispatcher. Neither the cron
    # command nor the pg_net queue contains the permanent Vault credential.
    endpoint = sql_literal(f"https://{ref}.supabase.co/functions/v1/send-quote-followups")
    stage = "scheduler installation"
    query("""
      begin;
      create or replace function public.dispatch_quote_followups() returns bigint
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
        proof:='cadova-v1:'||issued||':'||nonce||':'||encode(""" + crypto_schema + """.hmac('run:'||issued||':'||nonce,credential,'sha256'),'hex');
        select net.http_post(
          url=>""" + endpoint + """,
          headers=>jsonb_build_object('Authorization','Bearer '||proof,'Content-Type','application/json'),
          body=>' {"action":"run"} '::jsonb,
          timeout_milliseconds=>120000
        ) into request_id;
        return request_id;
      end;
      $$;
      revoke all on function public.dispatch_quote_followups() from public,anon,authenticated,service_role;
      select cron.unschedule(jobid) from cron.job where jobname='cadova-quote-followups';
      select cron.schedule('cadova-quote-followups','*/5 * * * *','select public.dispatch_quote_followups();');
      commit;
    """)
    health = None
    for attempt in range(4):
        try:
            # Health only synchronizes safe readiness. It never claims or sends.
            health = request_json(
                f"https://{ref}.supabase.co/functions/v1/send-quote-followups",
                {"Authorization": "Bearer " + scheduler_secret}, "POST", {"action": "health"},
            )
            break
        except DeploymentError:
            if attempt == 3:
                raise
            time.sleep(2)
    if health.get("claimed") != 0 or health.get("sent") != 0:
        raise DeploymentError("The worker health response did not satisfy its no-send contract.")
    scheduler = query("""
      select jobname,schedule,active,command from cron.job where jobname='cadova-quote-followups';
    """)
    if len(scheduler) != 1 or not scheduler[0]["active"]:
        raise DeploymentError("The quote followup scheduler was not installed correctly.")
    return {
        "status": "deployed", "project_ref": ref, "function_status": deployed.get("status"),
        "scheduler_ready": True, "schedule": "*/5 * * * *", "email_service": health.get("service"),
        "missing_email_secret_names": sorted({"RESEND_API_KEY", "RESEND_FROM"} - secret_names),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--inspect", action="store_true", help="Read project readiness without writing")
    group.add_argument("--deploy", action="store_true", help="Install the schema, private worker and scheduler")
    args = parser.parse_args()
    try:
        print(json.dumps(deploy("inspect" if args.inspect else "deploy")))
    except DeploymentError as error:
        print(json.dumps({"status": "failed", "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
