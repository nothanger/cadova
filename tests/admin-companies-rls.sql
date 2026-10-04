-- Disposable PostgreSQL test after migration 0008. Fixtures are rolled back.
begin;
insert into auth.users(id,email,banned_until) values
  ('a1000000-0000-4000-8000-000000000001','company-admin@example.test',null),
  ('a1000000-0000-4000-8000-000000000002','other-company-admin@example.test',null),
  ('a1000000-0000-4000-8000-000000000003','banned-company-admin@example.test',now()+interval '1 day'),
  ('a2000000-0000-4000-8000-000000000001','free-owner@example.test',null),
  ('a2000000-0000-4000-8000-000000000002','existing-owner@example.test',null),
  ('a2000000-0000-4000-8000-000000000003','banned-owner@example.test',now()+interval '1 day');
insert into public.platform_admins(user_id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003');
insert into public.companies(id,name) values('a3000000-0000-4000-8000-000000000001','Existing company');
insert into public.company_members(company_id,user_id,role) values('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',true);
do $$
begin
  begin
    perform public.admin_create_company('Forbidden normal company');
    raise exception 'Normal user can create through admin RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_delete_company('a3000000-0000-4000-8000-000000000001','Existing company');
    raise exception 'Normal user can delete through admin RPC';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
do $$
begin
  begin perform public.admin_create_company('Forbidden suspended admin'); raise exception 'Suspended admin can create'; exception when insufficient_privilege then null; end;
  begin perform public.admin_delete_company('a3000000-0000-4000-8000-000000000001','Existing company'); raise exception 'Suspended admin can delete'; exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$
declare created uuid; invalid_name text; affected integer;
begin
  perform public.admin_create_company('  Admin company one  ');
  perform public.admin_create_company('Admin company two',null);
  if (select count(*) from public.company_members where user_id=auth.uid() and role='owner')<>2 then raise exception 'Admin default owner or multiple-company ownership failed'; end if;
  perform public.admin_create_company('Other admin company one','a1000000-0000-4000-8000-000000000002');
  perform public.admin_create_company('Other admin company two','a1000000-0000-4000-8000-000000000002');
  if (select count(*) from public.company_members where user_id='a1000000-0000-4000-8000-000000000002' and role='owner')<>2 then raise exception 'Other platform admin cannot own multiple companies'; end if;
  created:=public.admin_create_company('Normal owner company','a2000000-0000-4000-8000-000000000001');
  if not exists(select 1 from public.company_members where company_id=created and user_id='a2000000-0000-4000-8000-000000000001' and role='owner') then raise exception 'Selected owner not installed'; end if;
  begin
    perform public.admin_create_company('Second normal company','a2000000-0000-4000-8000-000000000001');
    raise exception 'Normal account gained second company';
  exception when check_violation then null; end;
  begin
    perform public.admin_create_company('Existing membership company','a2000000-0000-4000-8000-000000000002');
    raise exception 'Existing member gained second company';
  exception when check_violation then null; end;
  begin
    perform public.admin_create_company('Suspended owner company','a2000000-0000-4000-8000-000000000003');
    raise exception 'Suspended owner accepted';
  exception when no_data_found then null; end;
  begin
    perform public.admin_create_company('Missing owner company','a9000000-0000-4000-8000-000000000001');
    raise exception 'Missing owner accepted';
  exception when no_data_found then null; end;
  foreach invalid_name in array array[null::text,'','   ',repeat('n',121)] loop
    begin
      perform public.admin_create_company(invalid_name);
      raise exception 'Invalid company name accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  perform public.admin_create_company(repeat('n',120));
  -- No direct company DELETE policy is introduced, even for a global admin.
  begin
    delete from public.companies where id=created;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'Direct browser company deletion allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_delete_company(created,'normal owner company');
    raise exception 'Wrong confirmation case accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_delete_company(created,null);
    raise exception 'Missing confirmation accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_delete_company('a9000000-0000-4000-8000-000000000001','Missing company');
    raise exception 'Missing company delete succeeded';
  exception when no_data_found then null; end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.admin_audit_log where action='create_company')<>6 then raise exception 'Creation audit missing or failed creation audited'; end if;
  if (select count(*) from public.companies where name='Admin company one')<>1 then raise exception 'Company name was not trimmed'; end if;
end;
$$;

-- Populate the deletion target with a quote→client RESTRICT relationship, its
-- timeline and business reminders. Account-level support remains independent.
insert into public.clients(id,company_id,name)
  select 'a4000000-0000-4000-8000-000000000001',id,'Deletion target client' from public.companies where name='Normal owner company';
insert into public.quotes(id,company_id,client_id,reference,amount_cents)
  select 'a5000000-0000-4000-8000-000000000001',id,'a4000000-0000-4000-8000-000000000001','DELETE-1',10000 from public.companies where name='Normal owner company';
insert into public.quote_events(company_id,quote_id,event_type,created_by)
  select id,'a5000000-0000-4000-8000-000000000001','note','a2000000-0000-4000-8000-000000000001' from public.companies where name='Normal owner company';
insert into public.notifications(company_id,user_id,type,title,message)
  select id,'a2000000-0000-4000-8000-000000000001','daily_followup_summary','Daily reminder','Daily reminder' from public.companies where name='Normal owner company';
insert into public.support_threads(id,user_id) values('a6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001');

-- Force an audit write failure to verify creation/deletion and all cascades roll
-- back together. The temporary test trigger never exists outside this transaction.
create function pg_temp.reject_company_audit() returns trigger language plpgsql as $$
begin
  if new.action in ('create_company','delete_company') then
    raise exception 'Simulated audit failure' using errcode='P9991';
  end if;
  return new;
end;
$$;
create trigger admin_company_audit_failure before insert on public.admin_audit_log
  for each row execute function pg_temp.reject_company_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$
declare target uuid;
begin
  select id into target from public.companies where name='Normal owner company';
  begin
    perform public.admin_create_company('Audit rollback creation');
    raise exception 'Creation ignored journal failure';
  exception when sqlstate 'P9991' then null; end;
  begin
    perform public.admin_delete_company(target,'Normal owner company');
    raise exception 'Deletion ignored journal failure';
  exception when sqlstate 'P9991' then null; end;
  if exists(select 1 from public.companies where name='Audit rollback creation') then raise exception 'Failed creation left company behind'; end if;
  if not exists(select 1 from public.companies where id=target) then raise exception 'Failed deletion removed company'; end if;
  if not exists(select 1 from public.quotes where id='a5000000-0000-4000-8000-000000000001') then raise exception 'Failed deletion removed quote'; end if;
  if not exists(select 1 from public.clients where id='a4000000-0000-4000-8000-000000000001') then raise exception 'Failed deletion removed client'; end if;
  if not exists(select 1 from public.company_members where company_id=target) then raise exception 'Failed deletion removed membership'; end if;
end;
$$;
reset role;
do $$
begin
  if not exists(select 1 from public.notifications where type='daily_followup_summary') then raise exception 'Failed deletion removed notification'; end if;
end;
$$;
drop trigger admin_company_audit_failure on public.admin_audit_log;

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$
declare target uuid; deleted uuid;
begin
  select id into target from public.companies where name='Normal owner company';
  update public.companies set name='Renamed company' where id=target;
  begin
    perform public.admin_delete_company(target,'Normal owner company');
    raise exception 'Stale confirmation ignored current company name';
  exception when invalid_parameter_value then null; end;
  deleted:=public.admin_delete_company(target,'  Renamed company  ');
  if deleted<>target then raise exception 'Deletion returned wrong company ID'; end if;
  if exists(select 1 from public.companies where id=target) then raise exception 'Company not deleted'; end if;
  if exists(select 1 from public.clients where company_id=target) then raise exception 'Company clients not deleted'; end if;
  if exists(select 1 from public.quotes where company_id=target) then raise exception 'Company quotes not deleted'; end if;
  if exists(select 1 from public.quote_events where company_id=target) then raise exception 'Company timeline not deleted'; end if;
  if exists(select 1 from public.company_members where company_id=target) then raise exception 'Company memberships not deleted'; end if;
  if not exists(select 1 from public.companies where id='a3000000-0000-4000-8000-000000000001') then raise exception 'Other company was removed'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from auth.users)<>6 then raise exception 'Company deletion removed Auth accounts'; end if;
  if (select count(*) from public.admin_audit_log where action='delete_company')<>1 then raise exception 'Company deletion audit missing'; end if;
  if not exists(select 1 from public.admin_audit_log where action='delete_company' and target_user_id is null and company_id is not null) then raise exception 'Company-only audit target incorrect'; end if;
  if exists(select 1 from public.notifications where type='daily_followup_summary') then raise exception 'Company notifications not removed'; end if;
  if not exists(select 1 from public.support_threads where id='a6000000-0000-4000-8000-000000000001') then raise exception 'Company deletion removed account support thread'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin perform public.admin_create_company('Anonymous company'); raise exception 'Anonymous admin create allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_delete_company('a3000000-0000-4000-8000-000000000001','Existing company'); raise exception 'Anonymous admin delete allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
