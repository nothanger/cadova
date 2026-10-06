#!/usr/bin/env python3
"""Inspect/deploy company templates, quote work orders and company search.

Use SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in a secure environment.
No customer data, accounts or emails are created by this deployment.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MIGRATION = "0015_company_productivity.sql"
MARKER = "public.search_company_records(uuid,text,integer)"


class DeploymentError(Exception):
    pass


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def deploy(write):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    if not token or not re.fullmatch(r"[a-z0-9]{20}", ref):
        raise DeploymentError("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF securely.")
    origin = f"https://api.supabase.com/v1/projects/{ref}"

    def request(path, payload=None):
        headers = {"Authorization": "Bearer " + token}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode()
        try:
            with urllib.request.urlopen(urllib.request.Request(origin + path, data=data, headers=headers), timeout=55) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise DeploymentError(f"Management request failed: HTTP {error.code}.") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            raise DeploymentError("Management request failed.") from None

    if request("").get("status") != "ACTIVE_HEALTHY":
        raise DeploymentError("The Supabase project must be active and healthy.")

    def query(sql):
        return request("/database/query", {"query": sql})

    prerequisite = query("select to_regclass('public.quote_client_messages') is not null as ready;")[0]
    if prerequisite["ready"] is not True:
        raise DeploymentError("Deploy the existing quote/client followup migrations first.")
    source = (ROOT / "supabase/migrations" / MIGRATION).read_text()
    digest = "cadova-source-sha256:" + hashlib.sha256(source.encode()).hexdigest()
    state = query("select to_regprocedure(" + literal(MARKER) + ") is not null as installed, "
        "obj_description(to_regprocedure(" + literal(MARKER) + "),'pg_proc') as marker;")[0]
    if state["installed"] and state["marker"] != digest:
        raise DeploymentError("The installed migration differs from this source. Inspect before updating.")
    if write and not state["installed"]:
        query("begin;\n" + source + "\ncomment on function " + MARKER + " is " + literal(digest) + ";\ncommit;")
    if write or state["installed"]:
        protections = query("""select count(*)=3 and bool_and(c.relrowsecurity) as rls
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname in ('quote_work_orders','company_message_templates','company_message_profiles');""")[0]
        if protections["rls"] is not True:
            raise DeploymentError("Company productivity tables must remain protected by RLS.")
        private = query("select not has_function_privilege('anon'," + literal(MARKER) + ",'EXECUTE') as protected;")[0]
        if private["protected"] is not True:
            raise DeploymentError("Company search must require an authenticated account.")
    return {"status": "deployed" if write else "inspected", "migration": MIGRATION,
        "installed": write or state["installed"], "customer_or_email_created": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--inspect", action="store_true")
    mode.add_argument("--deploy", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(deploy(args.deploy)))
    except (DeploymentError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
