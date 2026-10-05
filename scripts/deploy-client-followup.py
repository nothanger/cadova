#!/usr/bin/env python3
"""Inspect/deploy client quote links and signed email event handling.

Use SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from a secure environment.
Deployment sends no email, creates no customer and does not enable receiving.
RESEND_WEBHOOK_SECRET must match a webhook configured in Resend. Receiving
requires its own verified domain and an explicit QUOTE_REPLY_EMAIL_ENABLED flag.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from edge_bundle import FUNCTION_ROOT, function_sources

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = (
    ("0012_quote_client_portal.sql", "public.issue_quote_client_send_link(text,uuid,uuid,text,timestamptz)"),
    ("0013_quote_email_events.sql", "public.read_quote_email_tracking_status()"),
    ("0014_quote_send_tracking.sql", "public.valid_quote_send_envelope(text,uuid,uuid,uuid,text,text,jsonb)"),
)
FUNCTIONS = ("quote-client-portal", "resend-events", "send-quote-document", "send-quote-followups")


class DeploymentError(Exception):
    pass


def request_json(url, headers, method="GET", body=None, raw=None):
    data = json.dumps(body).encode() if body is not None else raw
    request_headers = dict(headers)
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(
            url, data=data, headers=request_headers, method=method,
        ), timeout=55) as response:
            result = response.read()
            return json.loads(result) if result else None
    except urllib.error.HTTPError as error:
        # Provider/management error bodies can contain credentials or private data.
        raise DeploymentError(f"HTTP {error.code}: {method} {urllib.parse.urlsplit(url).path}") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise DeploymentError(f"Request failed: {method} {urllib.parse.urlsplit(url).path}") from None


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def deploy_function(management, authorization, slug):
    boundary = "cadova-client-" + secrets.token_hex(16)
    metadata = {"name": slug, "entrypoint_path": f"{slug}/index.ts", "verify_jwt": False}
    chunks = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'.encode(),
        json.dumps(metadata).encode(), b"\r\n",
    ]
    for source, data in function_sources(slug).items():
        name = source.relative_to(FUNCTION_ROOT).as_posix()
        chunks.extend([
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode(),
            data, b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    result = request_json(
        f"{management}/functions/deploy?slug={slug}",
        {**authorization, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        "POST", raw=b"".join(chunks),
    )
    if result.get("status") != "ACTIVE":
        raise DeploymentError(f"Function {slug} did not become active.")
    return result.get("status")


def verify_private_actions(ref):
    # Public quote access still requires an unguessable link; privileged actions
    # and webhook processing must reject unsigned or unauthenticated requests.
    cases = (
        ("quote-client-portal", {"action": "inspect", "quoteId": "00000000-0000-4000-8000-000000000001"}, {401}),
        ("quote-client-portal", {"action": "view", "token": "A" * 43}, {404, 410}),
        ("resend-events", {"type": "email.delivered"}, {401, 503}),
        ("send-quote-document", {"action": "send", "quoteId": "00000000-0000-4000-8000-000000000001",
            "recipientEmail": "verification@example.com", "subject": "Verification", "message": "Verification"}, {401}),
        ("send-quote-followups", {"action": "run"}, {401}),
    )
    results = []
    for slug, body, expected in cases:
        endpoint = f"https://{ref}.supabase.co/functions/v1/{slug}"
        request = urllib.request.Request(endpoint, data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status = response.status
        except urllib.error.HTTPError as error:
            status = error.code
        except (urllib.error.URLError, TimeoutError):
            raise DeploymentError(f"Unable to verify {slug}.") from None
        if status not in expected:
            raise DeploymentError(f"Unexpected unauthenticated response from {slug}: HTTP {status}.")
        results.append({"function": slug, "status": status})
    return results


def deploy(mode):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    if not token or not re.fullmatch(r"[a-z0-9]{20}", ref):
        raise DeploymentError("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF securely.")
    management = f"https://api.supabase.com/v1/projects/{ref}"
    authorization = {"Authorization": "Bearer " + token}
    project = request_json(management, authorization)
    if project.get("status") != "ACTIVE_HEALTHY":
        raise DeploymentError("The Supabase project is not active and healthy.")

    def query(sql):
        return request_json(management + "/database/query", authorization, "POST", {"query": sql})

    prerequisites = query("""select to_regclass('public.quote_initial_send_jobs') is not null as documents,
        to_regclass('public.quote_followup_jobs') is not null as followups,
        to_regclass('public.quote_events') is not null as events;""")[0]
    if not all(prerequisites.values()):
        raise DeploymentError("Deploy the existing document and followup features first.")
    states = []
    for filename, marker in MIGRATIONS:
        source = (ROOT / "supabase/migrations" / filename).read_text()
        digest = "cadova-source-sha256:" + hashlib.sha256(source.encode()).hexdigest()
        state = query("select to_regprocedure(" + literal(marker) + ") is not null as installed, "
            "obj_description(to_regprocedure(" + literal(marker) + "),'pg_proc') as marker;")[0]
        if state["installed"] and state["marker"] != digest:
            raise DeploymentError(f"Existing migration {filename} differs from this source. Inspect before updating.")
        states.append({"migration": filename, "installed": state["installed"]})
        if mode == "deploy" and not state["installed"]:
            query("begin;\n" + source + "\ncomment on function " + marker + " is " + literal(digest) + ";\ncommit;")

    functions = request_json(management + "/functions", authorization)
    secret_names = {item.get("name") for item in request_json(management + "/secrets", authorization)}
    if mode == "inspect":
        return {"status": "inspected", "migrations": states,
            "functions": {slug: any(item.get("slug") == slug for item in functions) for slug in FUNCTIONS},
            "webhook_secret_present": "RESEND_WEBHOOK_SECRET" in secret_names,
            "receiving_domain_present": "RESEND_RECEIVE_DOMAIN" in secret_names}
    statuses = {slug: deploy_function(management, authorization, slug) for slug in FUNCTIONS}
    protections = verify_private_actions(ref)
    rls = query("""select bool_and(c.relrowsecurity) as protected from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname in ('quote_client_links','quote_client_messages','quote_client_rate_buckets',
          'quote_email_deliveries','quote_email_provider_events','quote_email_reply_routes','quote_email_replies');""")[0]
    if rls["protected"] is not True:
        raise DeploymentError("The client and email tables must remain protected by RLS.")
    return {"status": "deployed", "functions": statuses, "access_checks": protections,
        "webhook_secret_present": "RESEND_WEBHOOK_SECRET" in secret_names,
        "receiving_domain_present": "RESEND_RECEIVE_DOMAIN" in secret_names,
        "email_or_customer_created": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--inspect", action="store_true")
    mode.add_argument("--deploy", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(deploy("inspect" if args.inspect else "deploy")))
    except (DeploymentError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
