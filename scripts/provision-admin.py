#!/usr/bin/env python3
"""Deploy Cadova administration and create one new administrator.

Requires SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_ADMIN_EMAIL.
SUPABASE_ADMIN_PASSWORD may supply a password retained in a password manager.
Secrets stay in memory. Inspect mode is read-only; provision mode refuses to
overwrite an existing account. Credentials are emitted only after verification.
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


class ProvisionError(Exception):
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
        # Never echo headers, keys or a potentially sensitive response body.
        raise ProvisionError(f"HTTP {error.code} during {method} {urllib.parse.urlsplit(url).path}") from None
    except (urllib.error.URLError, TimeoutError):
        raise ProvisionError(f"Network failure during {method} {urllib.parse.urlsplit(url).path}") from None


def provision(mode):
    access_token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    email = os.environ.get("SUPABASE_ADMIN_EMAIL", "").strip()
    if not access_token or not re.fullmatch(r"[a-z0-9]{20}", ref) or not email or "@" not in email:
        raise ProvisionError("Set SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_ADMIN_EMAIL.")
    management = f"https://api.supabase.com/v1/projects/{ref}"
    authorization = {"Authorization": f"Bearer {access_token}"}
    project = request_json(management, authorization)
    if project.get("status") != "ACTIVE_HEALTHY":
        raise ProvisionError("The selected Supabase project is not active and healthy.")

    def query(sql):
        return request_json(f"{management}/database/query", authorization, "POST", {"query": sql})

    literal_email = "'" + email.replace("'", "''") + "'"
    checks = query(
        "select exists(select 1 from auth.users where lower(email) = lower(" + literal_email + ")) as account_exists, "
        "to_regclass('public.companies') is not null as companies, "
        "to_regclass('public.company_members') is not null as memberships, "
        "to_regclass('public.notifications') is not null as notifications, "
        "to_regclass('public.quote_events') is not null as quote_events, "
        "to_regclass('public.platform_admins') is not null as administration;"
    )[0]
    if mode == "inspect":
        return {"project_ref": ref, "status": project["status"], "email": email, "checks": checks}
    if mode == "provision" and checks["account_exists"]:
        raise ProvisionError("This email already has an account; no password or permissions were overwritten.")
    if not all(checks[key] for key in ("companies", "memberships", "notifications", "quote_events")):
        raise ProvisionError("Apply the existing Cadova schema before provisioning administration.")

    password = None
    if mode == "provision":
        password = os.environ.get("SUPABASE_ADMIN_PASSWORD") or "CvA9!" + secrets.token_urlsafe(20)
        if len(password) < 20:
            raise ProvisionError("Use an administrator password of at least 20 characters.")

    root = Path(__file__).resolve().parents[1]
    migration = (root / "supabase/migrations/0006_platform_admin.sql").read_text()
    query("begin;\n" + migration + "\ncommit;")

    boundary = "cadova-" + secrets.token_hex(20)
    # Authentication is enforced by Auth.getUser(token) inside the handler, then
    # by a fresh server role lookup. This also supports asymmetric signing keys.
    metadata = {"name": "platform-admin", "entrypoint_path": "index.ts", "verify_jwt": False}
    chunks = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n".encode(),
        json.dumps(metadata).encode(), b"\r\n",
    ]
    for filename in ("index.ts", "handler.ts"):
        chunks.extend([
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode(),
            (root / "supabase/functions/platform-admin" / filename).read_bytes(), b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode())
    deployed = request_json(
        f"{management}/functions/deploy?slug=platform-admin",
        {**authorization, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        "POST", raw=b"".join(chunks),
    )
    if mode == "deploy":
        return {"status": "deployed", "project_ref": ref, "function_status": deployed.get("status")}

    keys = request_json(f"{management}/api-keys", authorization)
    service_key = next((key["api_key"] for key in keys if key.get("name") == "service_role"), None)
    anon_key = next((key["api_key"] for key in keys if key.get("name") == "anon"), None)
    if not service_key or not anon_key:
        raise ProvisionError("The selected project did not provide its server and public API keys.")
    project_url = f"https://{ref}.supabase.co"
    server_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    created = request_json(f"{project_url}/auth/v1/admin/users", server_headers, "POST", {
        "email": email, "password": password, "email_confirm": True,
    })
    user_id = created["id"]
    try:
        verification = verify_account(project_url, server_headers, anon_key, email, password, user_id)
    except Exception:
        # Only the new, unused account created by this invocation is removed.
        # Leave existing business records and the deployed schema untouched.
        try:
            request_json(f"{project_url}/rest/v1/platform_admins?user_id=eq.{user_id}", server_headers, "DELETE")
            request_json(f"{project_url}/auth/v1/admin/users/{user_id}", server_headers, "DELETE")
        except ProvisionError:
            raise ProvisionError("Verification failed and cleanup could not finish. Inspect the new account before retrying.") from None
        raise ProvisionError("Verification failed; the newly created account was removed. Retry after checking the deployment.") from None
    return {
        "status": "created_and_verified", "project_ref": ref, "user_id": user_id,
        "email": email, "password": password, "role": "ADMIN", "login_url": "https://cadova.fr/login",
        "administration_url": "https://cadova.fr/admin", "function_status": deployed.get("status"),
        "checks": verification,
    }


def verify_account(project_url, server_headers, anon_key, email, password, user_id):
    # The Auth API owns password hashing and the user's identity. No direct SQL
    # writes to auth.users or password hashes are used to bootstrap the account.
    request_json(f"{project_url}/rest/v1/platform_admins", {
        **server_headers, "Prefer": "return=minimal",
    }, "POST", {"user_id": user_id})
    session = request_json(f"{project_url}/auth/v1/token?grant_type=password", {"apikey": anon_key}, "POST", {
        "email": email, "password": password,
    })
    user_headers = {"apikey": anon_key, "Authorization": "Bearer " + session["access_token"]}
    verified_role = request_json(f"{project_url}/rest/v1/rpc/is_platform_admin", user_headers, "POST", {})
    if verified_role is not True:
        raise ProvisionError("The new account could not verify its administrator role.")
    users = None
    for attempt in range(8):
        try:
            users = request_json(f"{project_url}/functions/v1/platform-admin", user_headers, "POST", {
                "action": "list_users", "page": 1, "perPage": 10,
            })
            break
        except ProvisionError:
            if attempt == 7:
                raise
            time.sleep(1)
    companies = request_json(f"{project_url}/functions/v1/platform-admin", user_headers, "POST", {
        "action": "list_companies", "page": 1, "perPage": 10,
    })
    if not isinstance(users.get("users"), list) or not isinstance(companies.get("companies"), list):
        raise ProvisionError("The administrative API did not return the expected data.")
    return {"login": True, "role": True, "list_users": True, "list_companies": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--inspect", action="store_true", help="Check project and schema without changing data")
    group.add_argument("--deploy", action="store_true", help="Deploy the schema and function without creating an account")
    group.add_argument("--provision", action="store_true", help="Deploy administration and create a new administrator")
    args = parser.parse_args()
    try:
        print(json.dumps(provision("inspect" if args.inspect else "deploy" if args.deploy else "provision")))
    except ProvisionError as error:
        print(json.dumps({"status": "failed", "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
