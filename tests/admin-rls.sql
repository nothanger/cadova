-- Run after migrations 0001, 0002, 0004, 0005 and 0006 on a disposable database.
-- psql -v ON_ERROR_STOP=1 -f tests/admin-rls.sql
-- Every fixture is rolled back. Never use this script to bootstrap production.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'other-admin@example.test'),
  ('20000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'owner-b@example.test'),
  ('20000000-0000-4000-8000-000000000003', 'new-owner@example.test'),
  ('20000000-0000-4000-8000-000000000004', 'new-user@example.test');
insert into public.platform_admins (user_id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.companies (id, name) values
  ('30000000-0000-4000-8000-000000000001', 'Entreprise A'),
  ('30000000-0000-4000-8000-000000000002', 'Entreprise B');
insert into public.company_members (company_id, user_id, role) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'owner');
insert into public.clients (id, company_id, name) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Client A'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Client B');
insert into public.quotes (id, company_id, client_id, reference, amount_cents) values
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'DEV-A', 10000),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'DEV-B', 20000);
insert into public.quote_events (company_id, quote_id, event_type) values
  ('30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'note'),
  ('30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'note');
insert into public.notifications (company_id, user_id, type, title, message) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'daily_followup_summary', 'Rappel', 'Relance prévue'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'daily_followup_summary', 'Rappel', 'Relance prévue');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
do $$
declare n integer;
begin
  if public.is_platform_admin() then raise exception 'Normal user became an admin'; end if;
  if (select count(*) from public.platform_admins) <> 0 then raise exception 'Admin table leaked'; end if;
  if (select count(*) from public.companies) <> 1 then raise exception 'Company isolation failed'; end if;
  if (select count(*) from public.company_members) <> 1 then raise exception 'Membership isolation failed'; end if;
  if (select count(*) from public.clients) <> 1 then raise exception 'Client isolation failed'; end if;
  if (select count(*) from public.quotes) <> 1 then raise exception 'Quote isolation failed'; end if;
  if (select count(*) from public.quote_events) <> 1 then raise exception 'Timeline isolation failed'; end if;
  if (select count(*) from public.notifications) <> 1 then raise exception 'Notification isolation failed'; end if;
  update public.clients set name = 'Forbidden' where id = '40000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-company update succeeded'; end if;
  begin
    insert into public.clients (company_id, name) values ('30000000-0000-4000-8000-000000000002', 'Forbidden');
    raise exception 'Cross-company insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.platform_admins (user_id) values (auth.uid());
    raise exception 'Self-promotion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.platform_admins;
    raise exception 'Admin removal succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admin_audit_log (actor_id, target_user_id, action) values (auth.uid(), auth.uid(), 'delete_user');
    raise exception 'Audit forgery succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_transfer_company_owner('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003');
    raise exception 'Non-admin ownership transfer succeeded';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare n integer;
begin
  if not public.is_platform_admin() then raise exception 'Admin role missing'; end if;
  if (select count(*) from public.platform_admins) <> 1 then raise exception 'Other admin identity leaked through client RLS'; end if;
  if (select count(*) from public.companies) <> 2 then raise exception 'Admin company scope missing'; end if;
  if (select count(*) from public.clients) <> 2 then raise exception 'Admin client scope missing'; end if;
  if (select count(*) from public.quotes) <> 2 then raise exception 'Admin quote scope missing'; end if;
  if (select count(*) from public.quote_events) <> 2 then raise exception 'Admin timeline scope missing'; end if;
  update public.clients set notes = 'Admin edit' where id = '40000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Admin update failed'; end if;
  begin
    insert into public.platform_admins (user_id) values ('20000000-0000-4000-8000-000000000003');
    raise exception 'Browser admin promotion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_transfer_company_owner('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
    raise exception 'User gained a second company';
  exception when check_violation then null; end;
  begin
    perform public.admin_transfer_company_owner('30000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001');
    raise exception 'Missing user accepted as owner';
  exception when no_data_found then null; end;
  begin
    perform public.admin_transfer_company_owner('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003');
    raise exception 'Missing company accepted';
  exception when no_data_found then null; end;
  perform public.admin_transfer_company_owner('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003');
  if not exists (select 1 from public.company_members where company_id = '30000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000003' and role = 'owner') then
    raise exception 'New owner not installed';
  end if;
  if not exists (select 1 from public.company_members where company_id = '30000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000001' and role = 'member') then
    raise exception 'Previous owner was not retained as member';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.admin_audit_log) <> 1 then raise exception 'Transfer audit absent'; end if;
  if (select action from public.admin_audit_log limit 1) <> 'transfer_company_owner' then raise exception 'Transfer audit incorrect'; end if;
  begin
    delete from auth.users where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Protected admin was deleted';
  exception when check_violation then null; end;
  begin
    delete from auth.users where id = '20000000-0000-4000-8000-000000000003';
    raise exception 'Last owner was deleted';
  exception when check_violation then null; end;
  delete from auth.users where id = '20000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.clients where id = '40000000-0000-4000-8000-000000000001') then raise exception 'Account deletion purged clients'; end if;
  if not exists (select 1 from public.quotes where id = '50000000-0000-4000-8000-000000000001') then raise exception 'Account deletion purged quotes'; end if;
end;
$$;

-- Suspension is allowed for a sole owner and immediately revokes RLS access,
-- even though the request still uses the same JWT subject.
update auth.users set banned_until = now() + interval '1 day'
  where id = '20000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
do $$
begin
  if public.current_user_is_active() then raise exception 'Suspended account appears active'; end if;
  if (select count(*) from public.clients) <> 0 then raise exception 'Old token still grants suspended account access'; end if;
  if (select count(*) from public.quotes) <> 0 then raise exception 'Old token still grants quote access'; end if;
  if (select count(*) from public.notifications) <> 0 then raise exception 'Old token still grants notification access'; end if;
  begin
    perform public.create_company_with_owner('Forbidden suspended company');
    raise exception 'Suspended user created company';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
update auth.users set banned_until = null where id = '20000000-0000-4000-8000-000000000002';

-- Test the ordinary onboarding path remains functional, and a transferred owner
-- cannot subsequently create another company.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin
    perform public.create_company_with_owner('Forbidden duplicate company');
    raise exception 'Transferred owner gained second company';
  exception when check_violation then null; end;
end;
$$;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
select public.create_company_with_owner('Nouvelle entreprise');
do $$
begin
  if (select count(*) from public.company_members where user_id = auth.uid() and role = 'owner') <> 1 then raise exception 'Ordinary onboarding failed'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.is_platform_admin();
    raise exception 'Anonymous admin helper access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_transfer_company_owner('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003');
    raise exception 'Anonymous admin RPC access';
  exception when insufficient_privilege then null; end;
end;
$$;

reset role;
set local role service_role;
insert into public.admin_audit_log (actor_id, target_user_id, action) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'suspend_user');
do $$
begin
  begin
    update public.admin_audit_log set action = 'delete_user';
    raise exception 'Server journal is editable';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.admin_audit_log;
    raise exception 'Server journal is deletable';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
