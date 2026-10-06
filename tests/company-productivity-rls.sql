-- Disposable local database only: real tenant policies and RPC permissions.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message; end if; end $$;

insert into auth.users(id,email,banned_until) values
 ('cc100000-0000-4000-8000-000000000001','productivity-owner@example.test',null),
 ('cc100000-0000-4000-8000-000000000002','productivity-member@example.test',null),
 ('cc100000-0000-4000-8000-000000000003','productivity-other@example.test',null),
 ('cc100000-0000-4000-8000-000000000004','productivity-admin@example.test',null),
 ('cc100000-0000-4000-8000-000000000005','productivity-banned@example.test',now()+interval '1 day');
insert into public.platform_admins(user_id) values('cc100000-0000-4000-8000-000000000004');
insert into public.companies(id,name) values
 ('cc200000-0000-4000-8000-000000000001','First company'),
 ('cc200000-0000-4000-8000-000000000002','Other company');
insert into public.company_members(company_id,user_id,role) values
 ('cc200000-0000-4000-8000-000000000001','cc100000-0000-4000-8000-000000000001','owner'),
 ('cc200000-0000-4000-8000-000000000001','cc100000-0000-4000-8000-000000000002','member'),
 ('cc200000-0000-4000-8000-000000000001','cc100000-0000-4000-8000-000000000005','owner'),
 ('cc200000-0000-4000-8000-000000000002','cc100000-0000-4000-8000-000000000003','owner');
insert into public.clients(id,company_id,name,email,phone) values
 ('cc300000-0000-4000-8000-000000000001','cc200000-0000-4000-8000-000000000001','Élodie Cœur','elodie@example.test','+33 6 12 34 56 78'),
 ('cc300000-0000-4000-8000-000000000002','cc200000-0000-4000-8000-000000000002','Élodie autre entreprise','other@example.test','06 12 34 56 78');
insert into public.clients(company_id,name) select 'cc200000-0000-4000-8000-000000000001','Common client '||lpad(n::text,2,'0') from generate_series(1,21) n;
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status) values
 ('cc400000-0000-4000-8000-000000000001','cc200000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000001','DEV-ACCEPTÉ',123456,'accepted'),
 ('cc400000-0000-4000-8000-000000000002','cc200000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000001','LIT-%_-2026',123450,'draft'),
 ('cc400000-0000-4000-8000-000000000003','cc200000-0000-4000-8000-000000000002','cc300000-0000-4000-8000-000000000002','DEV-OTHER',123456,'accepted');

set local role authenticated;
select set_config('request.jwt.claim.sub','cc100000-0000-4000-8000-000000000001',true);
select public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','to_schedule');
select public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','to_schedule');
select pg_temp.assert((select count(*)=1 from public.quote_events where event_type='work_order_change'),'Duplicate save duplicated work history');
do $$ declare original_version timestamptz; current_version timestamptz; affected integer; begin
  select updated_at into original_version from public.quote_work_orders where quote_id='cc400000-0000-4000-8000-000000000001';
  perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','scheduled',current_date+2,original_version);
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','in_progress',null,original_version);
    raise exception 'Stale browser overwrote intervention'; exception when serialization_failure then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','completed');
    raise exception 'Concurrent creation overwrote intervention'; exception when serialization_failure then null; end;
  select updated_at into current_version from public.quote_work_orders where quote_id='cc400000-0000-4000-8000-000000000001';
  perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','in_progress',current_date+2,current_version);
  select updated_at into current_version from public.quote_work_orders where quote_id='cc400000-0000-4000-8000-000000000001';
  perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','completed',current_date+2,current_version);
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000002','to_schedule');
    raise exception 'Draft received intervention'; exception when check_violation then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000003','to_schedule');
    raise exception 'Member updated another company intervention'; exception when insufficient_privilege then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','scheduled');
    raise exception 'Scheduled intervention without date'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','to_schedule',current_date);
    raise exception 'Unscheduled intervention kept date'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','accepted');
    raise exception 'Commercial status accepted as work status'; exception when invalid_parameter_value then null; end;
  begin update public.quote_work_orders set status='in_progress'; raise exception 'Browser directly changed intervention'; exception when insufficient_privilege then null; end;
  begin delete from public.quote_work_orders; raise exception 'Browser deleted intervention'; exception when insufficient_privilege then null; end;
  begin insert into public.quote_events(company_id,quote_id,event_type,work_order_status,content)
    values('cc200000-0000-4000-8000-000000000001','cc400000-0000-4000-8000-000000000001','work_order_change','completed','Forged');
    raise exception 'Browser forged intervention history'; exception when insufficient_privilege then null; end;
  update public.quote_events set content='Changed' where event_type='work_order_change'; get diagnostics affected=row_count;
  perform pg_temp.assert(affected=0,'Browser rewrote intervention history');
  delete from public.quote_events where event_type='work_order_change'; get diagnostics affected=row_count;
  perform pg_temp.assert(affected=0,'Browser deleted intervention history');
end $$;
select pg_temp.assert((select status='accepted' from public.quotes where id='cc400000-0000-4000-8000-000000000001'),'Intervention changed commercial status');
select pg_temp.assert((select count(*)=4 from public.quote_events where event_type='work_order_change'),'Intervention changes missing/duplicated');
select pg_temp.assert((select count(*)=1 from public.quote_events where event_type='work_order_change' and work_order_status='scheduled' and work_order_scheduled_for=current_date+2),'Scheduled metadata missing');

select public.save_company_message_template('cc200000-0000-4000-8000-000000000001','quote_send',' Devis {{ quote_reference }} ',E'Bonjour {{ client_name }},\n{{company_name}} {{amount_formatted}}');
select pg_temp.assert((select subject_template='Devis {{quote_reference}}' and strpos(body_template,'{{client_name}}')>0 from public.company_message_templates),'Allowed variable spacing not normalized');
select public.save_company_message_profile('cc200000-0000-4000-8000-000000000001',E'Ethan\nCadova');
do $$ begin
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','first_followup','Objet','{{unknown}}');
    raise exception 'Unknown variable saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','first_followup','Objet','{client_name}');
    raise exception 'Malformed variable saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','first_followup',E'Objet\nInjected','Corps');
    raise exception 'Multiline subject saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','first_followup',repeat('x',161),'Corps');
    raise exception 'Oversized subject saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','first_followup','Objet',repeat('x',4001));
    raise exception 'Oversized body saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','unknown','Objet','Corps');
    raise exception 'Unknown message kind saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_profile('cc200000-0000-4000-8000-000000000001',repeat('x',801));
    raise exception 'Oversized signature saved'; exception when invalid_parameter_value then null; end;
  begin perform public.save_company_message_profile('cc200000-0000-4000-8000-000000000001','{{company_name}}');
    raise exception 'Signature interpreted variable'; exception when invalid_parameter_value then null; end;
  begin update public.company_message_templates set body_template='Forged'; raise exception 'Browser directly changed template'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','elodie')->'items')=3,'Accent search missing client or quotes');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','coeur')->'items')=3,'French ligature search failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','0612345678')->'items')=3,'French domestic phone did not match +33');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','0033 6 12 34 56 78')->'items')=3,'International phone search failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','+33 6')->'items')=3,'International phone prefix search failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','elodie@example.test')->'items')=3,'Email search failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','DEV-accepte')->'items')=1,'Quote reference accents failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','%_')->'items')=1,'Wildcard characters expanded literal search');
select pg_temp.assert((public.search_company_records('cc200000-0000-4000-8000-000000000001','1 234,56 €')->'items'->0->>'amount_cents')::bigint=123456,'Exact French euro amount failed');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','1234.56')->'items')=1,'Exact amount leaked near match/tenant');
select pg_temp.assert((public.search_company_records('cc200000-0000-4000-8000-000000000001','Common',2)->>'hasMore')::boolean,'Pagination lost hasMore');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000001','Common',2)->'items')=2,'Requested result bound ignored');
select pg_temp.assert(not(public.search_company_records('cc200000-0000-4000-8000-000000000001','Common',40)->>'hasMore')::boolean,'hasMore fabricated after last result');
do $$ begin
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000002','elodie'); raise exception 'Search crossed tenant'; exception when insufficient_privilege then null; end;
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000001','x'); raise exception 'Short search allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000001',repeat('x',121)); raise exception 'Oversized search allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000001','Common',41); raise exception 'Unbounded search allowed'; exception when invalid_parameter_value then null; end;
end $$;

-- Members can use company tools but only owners/admins edit reusable wording.
select set_config('request.jwt.claim.sub','cc100000-0000-4000-8000-000000000002',true);
select pg_temp.assert((select count(*)=1 from public.company_message_templates),'Member cannot read template');
select pg_temp.assert((select count(*)=1 from public.company_message_profiles),'Member cannot read signature');
do $$ begin
  begin perform public.save_company_message_template('cc200000-0000-4000-8000-000000000001','quote_send','Changed','Changed'); raise exception 'Member edited template'; exception when insufficient_privilege then null; end;
  begin perform public.delete_company_message_template('cc200000-0000-4000-8000-000000000001','quote_send'); raise exception 'Member deleted template'; exception when insufficient_privilege then null; end;
  begin perform public.save_company_message_profile('cc200000-0000-4000-8000-000000000001','Changed'); raise exception 'Member edited signature'; exception when insufficient_privilege then null; end;
  perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','to_schedule',null,
    (select updated_at from public.quote_work_orders where quote_id='cc400000-0000-4000-8000-000000000001'));
end $$;

select set_config('request.jwt.claim.sub','cc100000-0000-4000-8000-000000000003',true);
select pg_temp.assert(not exists(select 1 from public.quote_work_orders),'Work order RLS exposed foreign company');
select pg_temp.assert(not exists(select 1 from public.company_message_templates),'Template RLS exposed foreign company');
select pg_temp.assert(not exists(select 1 from public.company_message_profiles),'Signature RLS exposed foreign company');

-- Explicit admin company scope works without inventing membership rows.
select set_config('request.jwt.claim.sub','cc100000-0000-4000-8000-000000000004',true);
select public.save_quote_work_order('cc400000-0000-4000-8000-000000000003','to_schedule');
select public.save_company_message_template('cc200000-0000-4000-8000-000000000002','first_followup','Objet','Corps');
select public.save_company_message_profile('cc200000-0000-4000-8000-000000000002','Other business signature');
select pg_temp.assert(jsonb_array_length(public.search_company_records('cc200000-0000-4000-8000-000000000002','elodie')->'items')=2,'Admin selected-company search failed');
select pg_temp.assert(not exists(select 1 from jsonb_array_elements(public.search_company_records('cc200000-0000-4000-8000-000000000002','elodie')->'items') item where item->>'company_id'<>'cc200000-0000-4000-8000-000000000002'),'Admin search lost selected company scope');
select public.delete_company_message_template('cc200000-0000-4000-8000-000000000002','first_followup');
select public.save_company_message_profile('cc200000-0000-4000-8000-000000000002','');
select pg_temp.assert((select email_signature='' from public.company_message_profiles where company_id='cc200000-0000-4000-8000-000000000002'),'Signature could not be cleared');

select set_config('request.jwt.claim.sub','cc100000-0000-4000-8000-000000000005',true);
select pg_temp.assert(not exists(select 1 from public.quote_work_orders),'Suspended user retained work order reads');
select pg_temp.assert(not exists(select 1 from public.company_message_templates),'Suspended user retained template reads');
do $$ begin
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000001','elodie'); raise exception 'Suspended user searched'; exception when insufficient_privilege then null; end;
  begin perform public.save_company_message_profile('cc200000-0000-4000-8000-000000000001','Changed'); raise exception 'Suspended owner edited signature'; exception when insufficient_privilege then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','completed'); raise exception 'Suspended member updated work'; exception when insufficient_privilege then null; end;
end $$;

-- Service writes also obey accepted status and quote/company identity.
reset role;
do $$ begin
  begin insert into public.quote_work_orders(quote_id,company_id,status) values('cc400000-0000-4000-8000-000000000002','cc200000-0000-4000-8000-000000000001','to_schedule'); raise exception 'Service tracked draft work'; exception when check_violation then null; end;
  begin update public.quote_work_orders set company_id='cc200000-0000-4000-8000-000000000001' where quote_id='cc400000-0000-4000-8000-000000000003'; raise exception 'Cross-company work mutation allowed'; exception when check_violation then null; end;
end $$;
set local role anon;
do $$ begin
  begin select * from public.quote_work_orders; raise exception 'Anonymous read work orders'; exception when insufficient_privilege then null; end;
  begin select * from public.company_message_templates; raise exception 'Anonymous read templates'; exception when insufficient_privilege then null; end;
  begin select * from public.company_message_profiles; raise exception 'Anonymous read signatures'; exception when insufficient_privilege then null; end;
  begin perform public.search_company_records('cc200000-0000-4000-8000-000000000001','elodie'); raise exception 'Anonymous searched'; exception when insufficient_privilege then null; end;
  begin perform public.save_quote_work_order('cc400000-0000-4000-8000-000000000001','completed'); raise exception 'Anonymous saved work'; exception when insufficient_privilege then null; end;
end $$;
rollback;
