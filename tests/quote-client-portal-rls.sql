-- Disposable local database; no provider/network calls or real identities.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','portal-owner@example.test'),
 ('a1000000-0000-4000-8000-000000000002','portal-other@example.test'),
 ('a1000000-0000-4000-8000-000000000003','portal-member@example.test');
insert into public.companies(id,name) values ('a2000000-0000-4000-8000-000000000001','Portal company'),('a2000000-0000-4000-8000-000000000002','Other company');
insert into public.company_members(company_id,user_id,role) values
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','owner'),
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','owner'),
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','member');
insert into public.company_email_settings(company_id,reply_to) values
 ('a2000000-0000-4000-8000-000000000001','contact@example.test'),
 ('a2000000-0000-4000-8000-000000000002','PRIVATE-OTHER@example.test');
insert into public.clients(id,company_id,name,email,phone,notes) values
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Portal client','PRIVATE@example.test','PRIVATE','PRIVATE');
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at,notes,next_followup_at)
 select ('a4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','PORTAL-'||n,123400,
  case when n=4 then 'draft' else 'sent' end,case when n=4 then null else current_date-5 end,'PRIVATE',current_date from generate_series(1,4)n;
insert into public.quote_followup_automations(quote_id,company_id,enabled,generation,activated_by)
 values('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',true,1,'a1000000-0000-4000-8000-000000000001');
insert into public.quote_followup_jobs(quote_id,company_id,generation,step,scheduled_at,next_attempt_at)
 values('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',1,1,clock_timestamp(),clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select public.create_quote_client_link('a4000000-0000-4000-8000-000000000001',repeat('a',64),clock_timestamp()+interval '1 day');
select public.create_quote_client_link('a4000000-0000-4000-8000-000000000002',repeat('b',64),clock_timestamp()+interval '1 day');
select public.create_quote_client_link('a4000000-0000-4000-8000-000000000003',repeat('c',64),clock_timestamp()+interval '1 day');
do $$ begin
 begin select token_hash from public.quote_client_links; raise exception 'Member read secret hashes'; exception when insufficient_privilege then null; end;
 begin perform public.use_quote_client_link(repeat('a',64),'view'); raise exception 'Authenticated bypassed Edge gateway'; exception when insufficient_privilege then null; end;
 begin perform public.issue_quote_client_send_link('initial',gen_random_uuid(),gen_random_uuid(),repeat('d',64),clock_timestamp()+interval '1 day'); raise exception 'Member issued service job link'; exception when insufficient_privilege then null; end;
 perform pg_temp.assert(not(public.inspect_quote_client_link('a4000000-0000-4000-8000-000000000001')::text like '%token%'),'Inspect leaked capability/hash');
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.inspect_quote_client_link('a4000000-0000-4000-8000-000000000001'); raise exception 'Other tenant inspected link'; exception when insufficient_privilege then null; end;
 begin perform public.create_quote_client_link('a4000000-0000-4000-8000-000000000001',repeat('d',64),clock_timestamp()+interval '1 day'); raise exception 'Other tenant created link'; exception when insufficient_privilege then null; end;
 begin perform public.revoke_quote_client_links('a4000000-0000-4000-8000-000000000001'); raise exception 'Other tenant revoked link'; exception when insufficient_privilege then null; end;
 begin perform public.reply_quote_client_message('a4000000-0000-4000-8000-000000000001','Forged reply',gen_random_uuid()); raise exception 'Other tenant replied'; exception when insufficient_privilege then null; end;
 perform pg_temp.assert(not exists(select 1 from public.quote_client_messages),'Other tenant read conversation');
end $$;
set local role anon;
do $$ begin
 begin select * from public.quote_client_messages; raise exception 'Anon read conversation table'; exception when insufficient_privilege then null; end;
 begin select * from public.quote_client_links; raise exception 'Anon read link table'; exception when insufficient_privilege then null; end;
 begin perform public.use_quote_client_link(repeat('a',64),'view'); raise exception 'Anon called service portal RPC'; exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$ declare v jsonb; n uuid:='a6000000-0000-4000-8000-000000000001'; begin
 v:=public.use_quote_client_link(repeat('a',64),'view');
 perform pg_temp.assert(v->'quote'->>'reference'='PORTAL-1' and not(v::text like '%PRIVATE%'),'Public view leaked private contact/notes');
 perform pg_temp.assert(v->'quote'->>'company_email'='contact@example.test','Business contact was missing or from another tenant');
 perform pg_temp.assert((v->'messages')='[]','Private events leaked into public messages');
 perform pg_temp.assert(public.use_quote_client_link(repeat('f',64),'view')->>'errorCode'='link_unavailable','Missing link exposed existence');
 perform pg_temp.assert(public.use_quote_client_link(repeat('a',64),'respond','question','Test?',n,false)->>'errorCode'='invalid_request','Unconfirmed response accepted');
 perform pg_temp.assert(public.use_quote_client_link(repeat('a',64),'respond','question','Bad'||chr(1),n,true)->>'errorCode'='invalid_request','Control characters accepted');
 v:=public.use_quote_client_link(repeat('a',64),'respond','question','Une question',n,true);
 perform pg_temp.assert(jsonb_array_length(v->'messages')=1,'Question was not stored');
 v:=public.use_quote_client_link(repeat('a',64),'respond','question','Une question',n,true);
 perform pg_temp.assert(jsonb_array_length(v->'messages')=1,'Retry duplicated question');
 perform pg_temp.assert(public.use_quote_client_link(repeat('a',64),'respond','question','Different question',n,true)->>'errorCode'='nonce_conflict','Changed nonce reused');
 v:=public.use_quote_client_link(repeat('b',64),'respond','accepted',null,'a6000000-0000-4000-8000-000000000002',true);
 perform pg_temp.assert(v->'quote'->>'status'='accepted','Acceptance failed');
 v:=public.use_quote_client_link(repeat('b',64),'respond','accepted',null,'a6000000-0000-4000-8000-000000000002',true);
 perform pg_temp.assert(jsonb_array_length(v->'messages')=1,'Acceptance retry duplicated decision');
 perform pg_temp.assert(public.use_quote_client_link(repeat('b',64),'respond','refused',null,gen_random_uuid(),true)->>'errorCode'='decision_not_allowed','Contradictory decision accepted');
 perform pg_temp.assert(public.consume_quote_client_rate('test:counter',1,60),'First rate hit refused');
 perform pg_temp.assert(not public.consume_quote_client_rate('test:counter',1,60),'Second rate hit allowed');
end $$;
reset role;
select pg_temp.assert((select not enabled and stop_reason='response_received' from public.quote_followup_automations where quote_id='a4000000-0000-4000-8000-000000000001'),'Question did not stop automation');
select pg_temp.assert((select status='cancelled' from public.quote_followup_jobs where quote_id='a4000000-0000-4000-8000-000000000001'),'Question did not cancel queued followup');
select pg_temp.assert((select next_followup_at is null from public.quotes where id='a4000000-0000-4000-8000-000000000001'),'Response left pending manual reminder');
select pg_temp.assert((select count(*)=2 from public.quote_events where portal_message_id is not null),'Repeated requests duplicated timeline events');
select pg_temp.assert((select count(*)=4 from public.notifications where portal_message_id is not null),'Members did not receive exactly one notification per message');
update public.quote_client_links set expires_at=clock_timestamp()-interval '1 second' where token_hash=repeat('c',64);
set local role service_role;
select pg_temp.assert(public.use_quote_client_link(repeat('c',64),'view')->>'errorCode'='link_unavailable','Expired link remained valid');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select public.reply_quote_client_message('a4000000-0000-4000-8000-000000000001','Bonjour, voici la réponse.','a6000000-0000-4000-8000-000000000003');
select public.reply_quote_client_message('a4000000-0000-4000-8000-000000000001','Bonjour, voici la réponse.','a6000000-0000-4000-8000-000000000003');
do $$ declare affected integer; begin
 perform pg_temp.assert((select count(*)=3 from public.quote_client_messages),'Member reply retry duplicated conversation');
 update public.quote_events set content='Forged' where portal_message_id is not null; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Member overwrote client response history');
 delete from public.quote_events where portal_message_id is not null; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Member erased client response history');
 begin insert into public.quote_client_messages(company_id,quote_id,author,kind,content,nonce) values('a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','client','accepted','Forged',gen_random_uuid()); raise exception 'Member forged public decision'; exception when insufficient_privilege then null; end;
end $$;
select public.revoke_quote_client_links('a4000000-0000-4000-8000-000000000001');
set local role service_role;
select pg_temp.assert(public.use_quote_client_link(repeat('a',64),'view')->>'errorCode'='link_unavailable','Revocation did not invalidate bearer');
-- Stable initial-send capability obeys worker leases and preserves expiry.
reset role;
insert into storage.objects(bucket_id,name,metadata) values('quote-documents','a2000000-0000-4000-8000-000000000001/a1000000-0000-4000-8000-000000000001/a5000000-0000-4000-8000-000000000001.pdf','{"mimetype":"application/pdf","size":9}');
insert into public.quote_documents(id,company_id,quote_id,storage_path,file_name,size_bytes,uploaded_by) values
 ('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001/a1000000-0000-4000-8000-000000000001/a5000000-0000-4000-8000-000000000001.pdf','devis.pdf',9,'a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select public.set_company_email_settings('a2000000-0000-4000-8000-000000000001','contact@example.test');
select public.request_quote_initial_send('a4000000-0000-4000-8000-000000000004','client@example.test','Votre devis','Bonjour');
set local role service_role;
do $$ declare j jsonb; l jsonb; again jsonb; begin
 select public.claim_quote_initial_send(id,'a1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='a4000000-0000-4000-8000-000000000004';
 l:=public.issue_quote_client_send_link('initial',(j->>'id')::uuid,(j->>'lease_token')::uuid,repeat('d',64),clock_timestamp()+interval '1 day');
 again:=public.issue_quote_client_send_link('initial',(j->>'id')::uuid,(j->>'lease_token')::uuid,repeat('d',64),clock_timestamp()+interval '2 days');
 perform pg_temp.assert(l=again,'Retry replaced stable token metadata/expiry');
 begin perform public.issue_quote_client_send_link('initial',(j->>'id')::uuid,gen_random_uuid(),repeat('d',64),clock_timestamp()+interval '1 day'); raise exception 'Stale worker lease issued link'; exception when check_violation then null; end;
 begin perform public.issue_quote_client_send_link('initial',(j->>'id')::uuid,(j->>'lease_token')::uuid,repeat('e',64),clock_timestamp()+interval '1 day'); raise exception 'Retry silently replaced token hash'; exception when check_violation then null; end;
 perform pg_temp.assert(public.use_quote_client_link(repeat('d',64),'view')->>'errorCode'='link_unavailable','Unsent draft exposed to client');
end $$;
set local role authenticated;
select public.revoke_quote_client_links('a4000000-0000-4000-8000-000000000004');
set local role service_role;
do $$ declare j public.quote_initial_send_jobs%rowtype; begin
 select * into j from public.quote_initial_send_jobs where quote_id='a4000000-0000-4000-8000-000000000004';
 begin perform public.issue_quote_client_send_link('initial',j.id,j.lease_token,repeat('d',64),clock_timestamp()+interval '1 day'); raise exception 'Retry revived revoked send token'; exception when check_violation then null; end;
end $$;
rollback;
