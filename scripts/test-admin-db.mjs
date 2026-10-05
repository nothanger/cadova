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

function concurrentSql(input, onOutput = () => {}) {
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
      onOutput(output)
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
    -- Small local Storage schema: exercise actual bucket/object RLS without
    -- network storage or any production credentials.
    create schema storage;
    create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,created_at timestamptz not null default clock_timestamp(),unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
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
    "0007_support_notifications.sql",
    "0008_admin_company_management.sql",
    "0009_quote_email_automation.sql",
    "0010_quote_followup_scheduler_auth.sql",
    "0011_quote_documents.sql",
    "0012_quote_client_portal.sql",
    "0013_quote_email_events.sql",
    "0014_quote_send_tracking.sql",
  ]) {
    sql(
      readFileSync(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    )
  }
  sql(
    readFileSync(new URL("../tests/quote-documents-rls.sql", import.meta.url), "utf8"),
  )
  sql(
    readFileSync(
      new URL("../tests/quote-client-portal-rls.sql", import.meta.url),
      "utf8",
    ),
  )
  sql(
    readFileSync(
      new URL("../tests/quote-email-events-rls.sql", import.meta.url),
      "utf8",
    ),
  )
  sql(
    readFileSync(new URL("../tests/quote-send-tracking.sql", import.meta.url), "utf8"),
  )
  sql(readFileSync(new URL("../tests/admin-rls.sql", import.meta.url), "utf8"))
  sql(readFileSync(new URL("../tests/notifications-rls.sql", import.meta.url), "utf8"))
  sql(
    readFileSync(new URL("../tests/admin-companies-rls.sql", import.meta.url), "utf8"),
  )
  sql(
    readFileSync(new URL("../tests/quote-automation-rls.sql", import.meta.url), "utf8"),
  )
  sql(
    readFileSync(
      new URL("../tests/quote-followup-scheduler-auth.sql", import.meta.url),
      "utf8",
    ),
  )
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
  const supportRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
    select public.send_support_message('Concurrent support',null,'91000000-0000-4000-8000-000000000001');
    select pg_sleep(0.25);
    commit;
  `),
    ),
  )
  if (supportRetries.some((result) => result.code !== 0)) {
    throw new Error("Concurrent support retries did not both succeed")
  }
  sql(`
    do $$ begin
      if (select count(*) from public.support_messages where request_id='91000000-0000-4000-8000-000000000001') <> 1 then
        raise exception 'Concurrent support retries duplicated a message';
      end if;
      if (select count(*) from public.notifications where type='support_message') <> 1 then
        raise exception 'Concurrent support retries duplicated notifications';
      end if;
    end $$;
  `)
  const announcementRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
    select public.send_admin_notification('Concurrent announcement','Concurrent announcement body',null,'92000000-0000-4000-8000-000000000001');
    select pg_sleep(0.25);
    commit;
  `),
    ),
  )
  if (announcementRetries.some((result) => result.code !== 0)) {
    throw new Error("Concurrent announcement retries did not both succeed")
  }
  sql(`
    do $$ begin
      if (select count(*) from public.admin_notification_dispatches where request_id='92000000-0000-4000-8000-000000000001') <> 1 then
        raise exception 'Concurrent announcement retries duplicated dispatches';
      end if;
      if (select count(*) from public.notifications where type='admin_announcement') <> (select count(*) from auth.users where banned_until is null or banned_until<=now()) then
        raise exception 'Concurrent announcement retries duplicated or omitted recipients';
      end if;
    end $$;
  `)
  sql(
    "insert into auth.users(id,email) values ('60000000-0000-4000-8000-000000000005','race-company-owner@example.test');",
  )
  const adminCreationAndOnboarding = await Promise.all([
    concurrentSql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
      select public.admin_create_company('Concurrent admin creation','60000000-0000-4000-8000-000000000005');
      select pg_sleep(0.25);
      commit;
    `),
    concurrentSql(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000005',true);
      select public.create_company_with_owner('Concurrent normal onboarding');
      select pg_sleep(0.25);
      commit;
    `),
  ])
  if (adminCreationAndOnboarding.filter((result) => result.code === 0).length !== 1) {
    throw new Error(
      "Concurrent admin creation and onboarding violated one-company rule",
    )
  }
  sql(`
    do $$ begin
      if (select count(*) from public.company_members where user_id='60000000-0000-4000-8000-000000000005') <> 1 then
        raise exception 'Concurrent admin creation and onboarding duplicated memberships';
      end if;
    end $$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',false);
    select public.admin_create_company('Concurrent deletion company');
    reset role;
  `)
  const deletionId = sql(
    "select id from public.companies where name='Concurrent deletion company';",
  ).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
  if (!deletionId) throw new Error("Concurrent deletion fixture was not created")
  const companyDeletes = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
    select public.admin_delete_company('${deletionId}','Concurrent deletion company');
    select pg_sleep(0.25);
    commit;
  `),
    ),
  )
  if (
    companyDeletes.filter((result) => result.code === 0).length !== 1 ||
    !companyDeletes.some((result) =>
      result.output.includes("Cette entreprise n’existe plus"),
    )
  ) {
    throw new Error("Concurrent company deletion did not serialize the target")
  }
  sql(`
    do $$ begin
      if exists(select 1 from public.companies where id='${deletionId}') then
        raise exception 'Concurrent deletion left target company';
      end if;
      if (select count(*) from public.admin_audit_log where action='delete_company' and company_id='${deletionId}') <> 1 then
        raise exception 'Concurrent deletion duplicated or omitted audit';
      end if;
      if not exists(select 1 from auth.users where id='60000000-0000-4000-8000-000000000004')
        or not exists(select 1 from public.platform_admins where user_id='60000000-0000-4000-8000-000000000004') then
        raise exception 'Concurrent deletion affected administrator identity';
      end if;
    end $$;
  `)
  sql(`
    insert into public.companies(id,name) values ('73000000-0000-4000-8000-000000000001','Automation races');
    insert into public.clients(id,company_id,name,email) values
      ('83000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','Race recipient','recipient@example.test');
    insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at) values
      ('93000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','RACE',10000,'sent',current_date-20);
    set role service_role;
    select public.set_quote_followup_service_status(true,true,'ready');
    reset role;
    set role authenticated;
    select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',false);
    select public.set_company_email_settings('73000000-0000-4000-8000-000000000001','contact@example.test');
    select public.save_quote_followup_automation('93000000-0000-4000-8000-000000000001',true);
    reset role;
    update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
      where quote_id='93000000-0000-4000-8000-000000000001' and step=1;
  `)
  let releaseConfigurationReady
  const configurationReady = new Promise((resolve) => {
    releaseConfigurationReady = resolve
  })
  const configurationWrite = concurrentSql(
    `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
      select public.save_quote_followup_automation('93000000-0000-4000-8000-000000000001',true,5,12,'Updated {{quote_reference}}','Updated {{client_name}}');
      reset role;
      update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
        where quote_id='93000000-0000-4000-8000-000000000001' and generation=2 and step=1;
      select 'AUTOMATION_CONFIGURATION_LOCKED';
      select pg_sleep(1);
      commit;
    `,
    (output) => {
      if (output.includes("AUTOMATION_CONFIGURATION_LOCKED")) {
        releaseConfigurationReady()
      }
    },
  )
  // Also release on failure so a failed setup cannot leave the test waiting.
  configurationWrite.then(releaseConfigurationReady, releaseConfigurationReady)
  await configurationReady
  const claimDuringConfiguration = await concurrentSql(`
    set role service_role;
    select 'CLAIMED='||count(*) from public.claim_quote_followup_jobs();
  `)
  const configurationResult = await configurationWrite
  if (
    configurationResult.code !== 0 ||
    claimDuringConfiguration.code !== 0 ||
    !claimDuringConfiguration.output.includes("CLAIMED=0")
  ) {
    throw new Error("A worker claimed an old generation during a configuration write")
  }
  sql(`
    do $$ begin
      if exists(select 1 from public.quote_followup_jobs where quote_id='93000000-0000-4000-8000-000000000001' and generation=1 and status<>'cancelled')
        or (select count(*) from public.quote_followup_jobs where quote_id='93000000-0000-4000-8000-000000000001' and generation=2 and status='queued')<>2 then
        raise exception 'Configuration race retained two active generations';
      end if;
    end $$;
    update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
      where quote_id='93000000-0000-4000-8000-000000000001' and generation=2 and step=1;
  `)
  const duplicateClaims = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
        begin;
        set local role service_role;
        select 'CLAIMED='||count(*) from public.claim_quote_followup_jobs();
        select pg_sleep(0.25);
        commit;
      `),
    ),
  )
  if (
    duplicateClaims.some((result) => result.code !== 0) ||
    duplicateClaims.reduce(
      (count, result) =>
        count + Number(result.output.match(/CLAIMED=(\d+)/)?.[1] ?? -10),
      0,
    ) !== 1
  ) {
    throw new Error("Two concurrent workers claimed the same follow-up")
  }
  sql(`
    do $$ begin
      if (select count(*) from public.quote_followup_jobs where quote_id='93000000-0000-4000-8000-000000000001' and status='processing' and attempts=1)<>1
        or (select count(*) from public.quote_followup_attempts where company_id='73000000-0000-4000-8000-000000000001')<>1 then
        raise exception 'Concurrent claims duplicated an attempt';
      end if;
    end $$;
  `)
  const proofEpoch = Math.floor(Date.now() / 1000)
  const proofRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
        begin;
        set local role service_role;
        select 'CONSUMED='||public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000010',${proofEpoch});
        select pg_sleep(0.25);
        commit;
      `),
    ),
  )
  if (
    proofRetries.some((result) => result.code !== 0) ||
    proofRetries.filter((result) => result.output.includes("CONSUMED=true")).length !==
      1 ||
    proofRetries.filter((result) => result.output.includes("CONSUMED=false")).length !==
      1
  ) {
    throw new Error("Concurrent scheduler proof replay was not rejected")
  }
  // Document import, send and sweep use real independent PostgreSQL sessions.
  // These races cover behavior that isolated unit mocks cannot exercise.
  const documentCompany = "74000000-0000-4000-8000-000000000001"
  const documentActor = "60000000-0000-4000-8000-000000000004"
  const documentIds = [1, 2, 3].map(
    (n) => `85000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  )
  const documentQuotes = [1, 2, 3].map(
    (n) => `94000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  )
  const documentPath = (index) =>
    `${documentCompany}/${documentActor}/${documentIds[index]}.pdf`
  const documentMetadata = (index) =>
    JSON.stringify({
      id: documentIds[index],
      storage_path: documentPath(index),
      file_name: "devis.pdf",
      size_bytes: 9,
    })
  const authenticatedDocumentSql = `set local role authenticated; select set_config('request.jwt.claim.sub','${documentActor}',true);`
  sql(`
    insert into public.companies(id,name) values('${documentCompany}','Document races');
    insert into storage.objects(bucket_id,name,metadata) values
      ('quote-documents','${documentPath(0)}','{"mimetype":"application/pdf","size":9}'),
      ('quote-documents','${documentPath(1)}','{"mimetype":"application/pdf","size":9}'),
      ('quote-documents','${documentPath(2)}','{"mimetype":"application/pdf","size":9}');
  `)
  const importRequest = (index) =>
    `select public.save_imported_quote('${documentQuotes[index]}','${documentCompany}',null,'{"name":"Document race client ${index}"}','DOC-RACE-${index}',1000,null,false,null,null,'${documentMetadata(index)}');`
  const importRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin; ${authenticatedDocumentSql} ${importRequest(0)} select pg_sleep(0.25); commit;
  `),
    ),
  )
  if (importRetries.some((result) => result.code !== 0))
    throw new Error("Concurrent identical document imports did not both recover")
  sql(`
    do $$ begin
      if (select count(*) from public.clients where company_id='${documentCompany}')<>1
        or (select count(*) from public.quotes where company_id='${documentCompany}')<>1
        or (select count(*) from public.quote_documents where company_id='${documentCompany}')<>1 then
        raise exception 'Concurrent document imports duplicated business records';
      end if;
    end $$;
    begin; ${authenticatedDocumentSql}
    select public.set_company_email_settings('${documentCompany}','reply@example.test'); commit;
  `)
  const sendRequest = `select public.request_quote_initial_send('${documentQuotes[0]}','client@example.test','Votre devis','Bonjour, voici votre devis.');`
  const sendRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin; ${authenticatedDocumentSql} ${sendRequest} select pg_sleep(0.25); commit;
  `),
    ),
  )
  if (sendRetries.some((result) => result.code !== 0))
    throw new Error("Concurrent initial-send requests did not both recover")
  sql(`do $$ begin
    if (select count(*) from public.quote_initial_send_jobs where quote_id='${documentQuotes[0]}')<>1 then
      raise exception 'Concurrent initial-send requests duplicated jobs';
    end if;
  end $$;`)
  const initialClaims = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin; set local role service_role;
    select 'CLAIMED='||(public.claim_quote_initial_send(id,'${documentActor}')->>'allowed')
      from public.quote_initial_send_jobs where quote_id='${documentQuotes[0]}';
    select pg_sleep(0.25); commit;
  `),
    ),
  )
  if (
    initialClaims.some((result) => result.code !== 0) ||
    initialClaims.filter((result) => result.output.includes("CLAIMED=true")).length !==
      1 ||
    initialClaims.filter((result) => result.output.includes("CLAIMED=false")).length !==
      1
  ) {
    throw new Error("Concurrent initial-send workers shared the same lease")
  }
  // Binding holds the Storage object row: the sweeper must skip it until the
  // attachment commits, then observe that it is live and keep it.
  sql(
    `update storage.objects set created_at=clock_timestamp()-interval '25 hours' where name='${documentPath(1)}';`,
  )
  let releaseBindingReady
  const bindingReady = new Promise((resolve) => {
    releaseBindingReady = resolve
  })
  const binding = concurrentSql(
    `
    begin; ${authenticatedDocumentSql} ${importRequest(1)}
    select 'DOCUMENT_BOUND_LOCKED'; select pg_sleep(1); commit;
  `,
    (output) => {
      if (output.includes("DOCUMENT_BOUND_LOCKED")) releaseBindingReady()
    },
  )
  binding.then(releaseBindingReady, releaseBindingReady)
  await bindingReady
  const sweepDuringBinding = await concurrentSql(`
    set role service_role;
    select 'TARGET_CLAIMED='||count(*) from public.claim_quote_document_cleanup()
      where storage_path='${documentPath(1)}';
  `)
  const bindingResult = await binding
  if (
    bindingResult.code !== 0 ||
    sweepDuringBinding.code !== 0 ||
    !sweepDuringBinding.output.includes("TARGET_CLAIMED=0")
  ) {
    throw new Error(
      "A sweeper claimed a PDF while its binding transaction held the object",
    )
  }
  sql(`do $$ begin
    if not exists(select 1 from public.quote_documents where storage_path='${documentPath(1)}')
      or exists(select 1 from public.quote_document_cleanup where storage_path='${documentPath(1)}') then
      raise exception 'Binding and sweeping lost a live document';
    end if;
  end $$;`)
  // In the reverse order, the sweeper's tombstone must permanently prevent
  // binding, including after its lease is released and physical deletion starts.
  sql(
    `update storage.objects set created_at=clock_timestamp()-interval '25 hours' where name='${documentPath(2)}';`,
  )
  let releaseSweepReady
  const sweepReady = new Promise((resolve) => {
    releaseSweepReady = resolve
  })
  const sweep = concurrentSql(
    `
    begin; set local role service_role; select * from public.claim_quote_document_cleanup();
    select 'DOCUMENT_SWEEP_LOCKED'; select pg_sleep(1); commit;
  `,
    (output) => {
      if (output.includes("DOCUMENT_SWEEP_LOCKED")) releaseSweepReady()
    },
  )
  sweep.then(releaseSweepReady, releaseSweepReady)
  await sweepReady
  const bindingDuringSweep = await concurrentSql(`
    begin; ${authenticatedDocumentSql}
    do $$ begin
      begin perform public.save_imported_quote('${documentQuotes[2]}','${documentCompany}',null,'{"name":"Must roll back race"}','SWEEP-RACE',1000,null,false,null,null,'${documentMetadata(2)}');
        raise exception 'Tombstoned object was bound';
      exception when check_violation then raise notice 'TOMBSTONE_REJECTED'; end;
    end $$; commit;
  `)
  const sweepResult = await sweep
  if (
    sweepResult.code !== 0 ||
    bindingDuringSweep.code !== 0 ||
    !bindingDuringSweep.output.includes("TOMBSTONE_REJECTED")
  ) {
    throw new Error(
      "A binding transaction revived an object already reserved for deletion",
    )
  }
  sql(`do $$ begin
    if exists(select 1 from public.quote_documents where storage_path='${documentPath(2)}')
      or exists(select 1 from public.clients where name='Must roll back race') then
      raise exception 'Tombstone race left a document or orphan client';
    end if;
  end $$;`)
  const cleanupProofEpoch = Math.floor(Date.now() / 1000)
  const cleanupProofRetries = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(`
    begin; set local role service_role;
    select 'CONSUMED='||public.consume_quote_document_cleanup_nonce('da000000-0000-4000-8000-000000000011',${cleanupProofEpoch});
    select pg_sleep(0.25); commit;
  `),
    ),
  )
  if (
    cleanupProofRetries.some((result) => result.code !== 0) ||
    cleanupProofRetries.filter((result) => result.output.includes("CONSUMED=true"))
      .length !== 1 ||
    cleanupProofRetries.filter((result) => result.output.includes("CONSUMED=false"))
      .length !== 1
  ) {
    throw new Error("Concurrent cleanup proof replay was not rejected")
  }
  sql(`
    insert into auth.users(id,email) values('b1000000-0000-4000-8000-000000000001','portal-race@example.test');
    insert into public.companies(id,name) values('b2000000-0000-4000-8000-000000000001','Portal race company');
    insert into public.company_members(company_id,user_id,role) values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','owner');
    insert into public.clients(id,company_id,name) values('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Race client');
    insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at)
      select ('b4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','RACE-'||n,1000,'sent',current_date-1 from generate_series(1,2)n;
    insert into public.quote_client_links(company_id,quote_id,token_hash,expires_at)
      select 'b2000000-0000-4000-8000-000000000001',('b4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,repeat(n::text,64),clock_timestamp()+interval '1 day' from generate_series(1,2)n;
  `)
  const decisions = await Promise.all(
    ["accepted", "refused"].map((kind, index) =>
      concurrentSql(
        `begin;set local role service_role;select public.use_quote_client_link(repeat('1',64),'respond','${kind}',null,'b6000000-0000-4000-8000-00000000000${index + 1}',true);select pg_sleep(0.15);commit;`,
      ),
    ),
  )
  if (
    decisions.some((result) => result.code !== 0) ||
    decisions.filter((result) => result.output.includes("decision_not_allowed"))
      .length !== 1
  )
    throw new Error("Concurrent decisions did not serialize")
  const questions = await Promise.all(
    [1, 2].map(() =>
      concurrentSql(
        `begin;set local role service_role;select public.use_quote_client_link(repeat('2',64),'respond','question','Same question','b6000000-0000-4000-8000-000000000003',true);select pg_sleep(0.15);commit;`,
      ),
    ),
  )
  if (questions.some((result) => result.code !== 0))
    throw new Error("Concurrent duplicate question failed")
  sql(`do $$begin
    if (select count(*) from public.quote_client_messages where company_id='b2000000-0000-4000-8000-000000000001')<>2 then raise exception 'Concurrent requests duplicated message';end if;
    if (select count(*) from public.quote_events where company_id='b2000000-0000-4000-8000-000000000001' and portal_message_id is not null)<>2 then raise exception 'Concurrent requests duplicated event';end if;
    if (select count(*) from public.notifications where company_id='b2000000-0000-4000-8000-000000000001' and portal_message_id is not null)<>2 then raise exception 'Concurrent requests duplicated notification';end if;
  end$$;`)
  console.log(
    "Administration, messagerie, relances, documents, portail et livraison : neuf suites SQL et dix-sept courses concurrentes validées. Aucun email envoyé.",
  )
} finally {
  docker(["exec", container, "dropdb", "-U", "postgres", "--force", database])
}
