import { readFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"
const container = process.env.ADMIN_TEST_CONTAINER ?? "cadova-admin-db"
const database = `cadova_admin_test_${process.pid}`

function docker(args, input) {
  const result = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message ?? result.stderr ?? "Local database test failed",
    )
  }
  return result.stdout
}
function sql(input) {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    input,
  )
}

function concurrentSql(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ])
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
    })
    child.stderr.on("data", (chunk) => {
      output += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, output }))
    child.stdin.end(input)
  })
}

// This intentionally targets a local Docker container, never a Supabase URL.
// The database name is generated here; it cannot point at an existing project.
docker(["exec", container, "createdb", "-U", "postgres", database])
try {
  sql(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    create table auth.users (id uuid primary key, email text, banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Supabase's standard schema defaults; 0006 explicitly narrows admin tables.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `)
  for (const migration of [
    "0001_initial_schema.sql",
    "0002_notifications.sql",
    "0004_reminder_prefs.sql",
    "0005_quote_workflow.sql",
    "0006_platform_admin.sql",
  ]) {
    sql(
      readFileSync(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    )
  }
  sql(readFileSync(new URL("../tests/admin-rls.sql", import.meta.url), "utf8"))
  sql(`
    insert into auth.users(id,email) values
      ('60000000-0000-4000-8000-000000000001','race-owner-a@example.test'),
      ('60000000-0000-4000-8000-000000000002','race-owner-b@example.test'),
      ('60000000-0000-4000-8000-000000000003','race-new-owner@example.test'),
      ('60000000-0000-4000-8000-000000000004','race-admin@example.test');
    insert into public.platform_admins(user_id) values ('60000000-0000-4000-8000-000000000004');
    insert into public.companies(id,name) values ('70000000-0000-4000-8000-000000000001','Concurrent owners');
    insert into public.clients(company_id,name) values ('70000000-0000-4000-8000-000000000001','Preserved client');
    insert into public.company_members(company_id,user_id,role) values
      ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','owner'),
      ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','owner');
  `)
  const deletes = await Promise.all(
    [1, 2].map((index) =>
      concurrentSql(`
    begin;
    delete from auth.users where id = '60000000-0000-4000-8000-00000000000${index}';
    select pg_sleep(0.25);
    commit;
  `),
    ),
  )
  if (
    deletes.filter((result) => result.code === 0).length !== 1 ||
    !deletes.some((result) => result.output.includes("Transfer company ownership"))
  ) {
    throw new Error("Concurrent deletion did not protect the final owner")
  }
  sql(`
    do $$ begin
      if (select count(*) from public.company_members where company_id = '70000000-0000-4000-8000-000000000001' and role = 'owner') <> 1 then
        raise exception 'Concurrent deletion removed the final owner';
      end if;
      if (select count(*) from public.clients where company_id = '70000000-0000-4000-8000-000000000001') <> 1 then
        raise exception 'Concurrent deletion purged company data';
      end if;
    end $$;
  `)
  const onboardingAndTransfer = await Promise.all([
    concurrentSql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
      select public.create_company_with_owner('Concurrent onboarding');
      select pg_sleep(0.25);
      commit;
    `),
    concurrentSql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
      select public.admin_transfer_company_owner('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003');
      select pg_sleep(0.25);
      commit;
    `),
  ])
  if (onboardingAndTransfer.filter((result) => result.code === 0).length !== 1) {
    throw new Error("Concurrent onboarding and transfer violated one-company rule")
  }
  sql(`
    do $$ begin
      if (select count(*) from public.company_members where user_id = '60000000-0000-4000-8000-000000000003') <> 1 then
        raise exception 'Concurrent onboarding and transfer created duplicate memberships';
      end if;
    end $$;
  `)
  console.log(
    "Administration : isolation RLS, transfert, suspension, journal et deux courses concurrentes validés.",
  )
} finally {
  docker(["exec", container, "dropdb", "-U", "postgres", "--force", database])
}
