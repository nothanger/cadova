-- Local disposable database only. Fake Storage metadata; no network or email.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
create function pg_temp.doc(n integer, company text default 'e2000000-0000-4000-8000-000000000001', actor text default 'e1000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select jsonb_build_object('id','e5000000-0000-4000-8000-'||lpad(n::text,12,'0'),'storage_path',company||'/'||actor||'/e5000000-0000-4000-8000-'||lpad(n::text,12,'0')||'.pdf','file_name','devis.pdf','size_bytes',9);
$$;
create function pg_temp.payload(j jsonb) returns jsonb language sql as $$
  select jsonb_build_object('from','Cadova <devis@cadova.fr>','to',j->>'recipient_email','reply_to',j->>'reply_to','subject',j->>'subject','text',j->>'body','html','<p>Devis de test</p>',
    'attachments',jsonb_build_array(jsonb_build_object('filename',j->>'file_name','content_type','application/pdf','content',encode(convert_to('%PDF-test','UTF8'),'base64'))));
$$;
insert into auth.users(id,email) values
 ('e1000000-0000-4000-8000-000000000001','import-owner@example.test'),
 ('e1000000-0000-4000-8000-000000000002','other-import-owner@example.test'),
 ('e1000000-0000-4000-8000-000000000003','import-member@example.test');
insert into public.companies(id,name) values
 ('e2000000-0000-4000-8000-000000000001','Import company'),
 ('e2000000-0000-4000-8000-000000000002','Other import company');
insert into public.company_members(company_id,user_id,role) values
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','owner'),
 ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','owner'),
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','member');
insert into public.clients(id,company_id,name,email) values
 ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','Existing client','existing@example.test'),
 ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','Other client','other@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
-- Staging upload belongs to the authenticated member, scoped by tenant.
insert into storage.objects(bucket_id,name,metadata) select 'quote-documents',pg_temp.doc(n)->>'storage_path','{"mimetype":"application/pdf","size":9}'::jsonb from generate_series(1,10)n;
do $$
begin
 begin insert into storage.objects(bucket_id,name,metadata) values('quote-documents',pg_temp.doc(50,'e2000000-0000-4000-8000-000000000002')->>'storage_path','{}'); raise exception 'Cross-company upload allowed'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name,metadata) values('quote-documents',pg_temp.doc(50,'e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003')->>'storage_path','{}'); raise exception 'Upload forged another member path'; exception when insufficient_privilege then null; end;
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000050','e2000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000002',null,'OTHER',1000,null,false,null,null,pg_temp.doc(1)); raise exception 'Cross-company import allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000050','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002',null,'OTHER-CLIENT',1000,null,false,null,null,pg_temp.doc(1)); raise exception 'Cross-company client attached'; exception when insufficient_privilege then null; end;
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000050','e2000000-0000-4000-8000-000000000001',null,'{"name":"Must roll back"}','INVALID-DOC',1000,null,false,null,null,pg_temp.doc(999)); raise exception 'Missing object accepted'; exception when check_violation then null; end;
 perform pg_temp.assert(not exists(select 1 from public.clients where name='Must roll back'),'Failed document import left orphan client');
end $$;
select public.save_imported_quote('e4000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',null,'{"name":"New import client","email":"new@example.test"}','IMPORT-1',1000,null,false,null,null,pg_temp.doc(1));
-- Identical retry must not duplicate client/document/event.
select public.save_imported_quote('e4000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',null,'{"name":"New import client","email":"new@example.test"}','IMPORT-1',1000,null,false,null,null,pg_temp.doc(1));
select pg_temp.assert((select count(*)=1 from public.clients where name='New import client'),'Import retry duplicated client');
do $$
begin
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000051','e2000000-0000-4000-8000-000000000001',null,'{"name":"Duplicate reference orphan"}','IMPORT-1',1000,null,false,null,null,pg_temp.doc(2)); raise exception 'Duplicate reference accepted'; exception when unique_violation then null; end;
 perform pg_temp.assert(not exists(select 1 from public.clients where name='Duplicate reference orphan'),'Duplicate reference left orphan client');
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000052','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'FUTURE',1000,null,true,current_date+7,null,null); raise exception 'Already sent future date accepted'; exception when invalid_parameter_value then null; end;
end $$;
select public.save_imported_quote('e4000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'ALREADY-SENT',1000,null,true,current_date-2,null,pg_temp.doc(2));
select pg_temp.assert((select status='sent' and sent_at=current_date-2 from public.quotes where id='e4000000-0000-4000-8000-000000000002'),'Already-sent date/status lost');
select pg_temp.assert((select count(*)=1 from public.quote_events where quote_id='e4000000-0000-4000-8000-000000000002' and initial_send_job_id is null),'Already-sent manual history missing');
select pg_temp.assert(not exists(select 1 from public.quote_initial_send_jobs) and not exists(select 1 from public.quote_followup_jobs),'Import unexpectedly sent or enabled followups');
-- Replacement is atomic and retires the old immutable path.
select public.attach_quote_document('e4000000-0000-4000-8000-000000000001',pg_temp.doc(3));
select public.attach_quote_document('e4000000-0000-4000-8000-000000000001',pg_temp.doc(3));
do $$ declare affected integer; begin
 delete from storage.objects where name=pg_temp.doc(3)->>'storage_path'; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Browser deleted bound document');
 update storage.objects set metadata='{}' where name=pg_temp.doc(3)->>'storage_path'; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Browser overwrote immutable attachment');
 begin perform public.attach_quote_document('e4000000-0000-4000-8000-000000000002',pg_temp.doc(4)); raise exception 'Sent attachment replaced'; exception when check_violation then null; end;
 begin select payload from public.quote_initial_send_payloads; raise exception 'Browser read private payload'; exception when insufficient_privilege then null; end;
 begin perform public.claim_quote_initial_send(gen_random_uuid(),auth.uid()); raise exception 'Browser claimed service job'; exception when insufficient_privilege then null; end;
end $$;
-- A teammate can read only the bound files, not another user's staging files.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000003',true);
select pg_temp.assert((select count(*)=2 from storage.objects),'Member read unbound staging or lost bound files');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select pg_temp.assert(not exists(select 1 from public.quote_documents) and not exists(select 1 from storage.objects),'Other tenant read quote documents');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select public.set_company_email_settings('e2000000-0000-4000-8000-000000000001','contact@example.test');
do $$ declare j jsonb; begin
 j:=public.request_quote_initial_send('e4000000-0000-4000-8000-000000000001','client@example.test','Votre devis','Bonjour, voici votre devis.');
 perform pg_temp.assert(j->>'status'='preparing','Initial send was not prepared');
 perform pg_temp.assert((public.request_quote_initial_send('e4000000-0000-4000-8000-000000000001','client@example.test','Votre devis','Bonjour, voici votre devis.')->>'id')=j->>'id','Double click duplicated send job');
 begin update public.quotes set amount_cents=2000 where id='e4000000-0000-4000-8000-000000000001'; raise exception 'Quote edited during prepared send'; exception when check_violation then null; end;
 begin perform public.attach_quote_document('e4000000-0000-4000-8000-000000000001',pg_temp.doc(4)); raise exception 'Attachment replaced during send'; exception when check_violation then null; end;
 begin perform public.request_quote_initial_send('e4000000-0000-4000-8000-000000000002','client@example.test','Votre devis','Bonjour'); raise exception 'Already-sent imported quote sent again'; exception when check_violation then null; end;
end $$;
-- Company deletion is restricted to its administrative RPC in the app. Run
-- the physical cascade here as the migration owner to exercise its guard.
reset role;
do $$ begin
 begin delete from public.companies where id='e2000000-0000-4000-8000-000000000001'; raise exception 'Company deleted during prepared send'; exception when check_violation then null; end;
end $$;
set local role service_role;
do $$ declare j jsonb; frozen jsonb; changed jsonb; payload jsonb; begin
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000001';
 perform pg_temp.assert((j->>'allowed')::boolean and j->>'mime_type'='application/pdf','Worker failed to claim PDF job');
 perform pg_temp.assert(not(public.claim_quote_initial_send((j->>'id')::uuid,'e1000000-0000-4000-8000-000000000001')->>'allowed')::boolean,'Live lease claimed twice');
 payload:=pg_temp.payload(j);
 begin perform public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,jsonb_set(payload,'{to}','"attacker@example.test"'),encode(sha256(convert_to('%PDF-test','UTF8')),'hex')); raise exception 'Payload recipient changed'; exception when invalid_parameter_value then null; end;
 begin perform public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,payload,repeat('0',64)); raise exception 'Wrong PDF hash accepted'; exception when invalid_parameter_value then null; end;
 frozen:=public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,payload,encode(sha256(convert_to('%PDF-test','UTF8')),'hex'));
 changed:=public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,jsonb_set(payload,'{html}','"Changed deployment template"'),encode(sha256(convert_to('%PDF-test','UTF8')),'hex'));
 perform pg_temp.assert(frozen=changed,'Retry changed frozen payload/timestamp');
 perform public.record_quote_initial_acceptance((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider-test-1');
 perform public.complete_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider-test-1');
 perform public.complete_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider-test-1');
 perform pg_temp.assert((select count(*)=1 from public.quote_events where initial_send_job_id=(j->>'id')::uuid),'Duplicate provider history');
 perform pg_temp.assert((select count(*)=1 from public.notifications where initial_send_job_id=(j->>'id')::uuid),'Duplicate provider notification');
 perform pg_temp.assert((select status='sent' and sent_at=(clock_timestamp() at time zone 'Europe/Paris')::date from public.quotes where id='e4000000-0000-4000-8000-000000000001'),'Provider completion lost send date');
end $$;
set local role authenticated;
do $$ declare affected integer; begin
 update public.quote_events set content='Forged' where initial_send_job_id is not null; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Browser changed acceptance history');
 delete from public.quote_events where initial_send_job_id is not null; get diagnostics affected=row_count;
 perform pg_temp.assert(affected=0,'Browser erased acceptance history');
 begin insert into public.quote_events(company_id,quote_id,event_type,created_by,delivery_status) values('e2000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001','sent',auth.uid(),'sent'); raise exception 'Browser forged provider acceptance'; exception when insufficient_privilege then null; end;
end $$;
-- Snapshot safety on ambiguous outcomes and exact same-key recovery.
select public.save_imported_quote('e4000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'AMBIGUOUS',1000,null,false,null,null,pg_temp.doc(4));
select public.request_quote_initial_send('e4000000-0000-4000-8000-000000000004','client@example.test','Devis ambigu','Bonjour');
set local role service_role;
do $$ declare j jsonb; begin
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000004';
 perform public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,pg_temp.payload(j),encode(sha256(convert_to('%PDF-test','UTF8')),'hex'));
 perform public.fail_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider_timeout',true);
end $$;
set local role authenticated;
do $$ declare j jsonb; begin
 select to_jsonb(x) into j from public.quote_initial_send_jobs x where quote_id='e4000000-0000-4000-8000-000000000004';
 begin perform public.cancel_quote_initial_send((j->>'id')::uuid); raise exception 'Ambiguous send cancelled'; exception when check_violation then null; end;
 begin delete from public.quotes where id='e4000000-0000-4000-8000-000000000004'; raise exception 'Ambiguous snapshot deleted'; exception when check_violation then null; end;
 perform pg_temp.assert((public.request_quote_initial_send('e4000000-0000-4000-8000-000000000004','client@example.test','Devis ambigu','Bonjour',true)->>'id')=j->>'id','Ambiguous retry changed idempotency key');
end $$;
set local role service_role;
do $$ declare j jsonb; begin
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000004';
 perform pg_temp.assert((j->>'allowed')::boolean and j->'provider_payload' is not null and (j->>'attempts')::integer=2,'Ambiguous retry lost snapshot');
 perform public.fail_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider_rejected',false);
 perform pg_temp.assert((select status='delivery_unknown' from public.quote_initial_send_jobs where id=(j->>'id')::uuid),'Later rejection cleared earlier ambiguity');
end $$;
reset role;
update public.quote_initial_send_jobs set first_attempt_at=clock_timestamp()-interval '24 hours' where quote_id='e4000000-0000-4000-8000-000000000004';
set local role authenticated;
select pg_temp.assert(public.request_quote_initial_send('e4000000-0000-4000-8000-000000000004','client@example.test','Devis ambigu','Bonjour',true)->>'status'='delivery_unknown','Expired idempotency window reopened');
-- A known provider rejection can only start a fresh request after explicit
-- retry. An accepted request is instead completed from its stored provider id.
select public.save_imported_quote('e4000000-0000-4000-8000-000000000005','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'KNOWN-REJECTION',1000,null,false,null,null,pg_temp.doc(5));
select public.save_imported_quote('e4000000-0000-4000-8000-000000000006','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'ACCEPTANCE-RECOVERY',1000,null,false,null,null,pg_temp.doc(6));
select public.request_quote_initial_send('e4000000-0000-4000-8000-000000000005','client@example.test','Devis rejeté','Bonjour');
select public.request_quote_initial_send('e4000000-0000-4000-8000-000000000006','client@example.test','Devis accepté','Bonjour');
set local role service_role;
do $$ declare j jsonb; begin
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000005';
 perform public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,pg_temp.payload(j),encode(sha256(convert_to('%PDF-test','UTF8')),'hex'));
 perform public.fail_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider_domain_unverified',false);
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000006';
 perform public.persist_quote_initial_payload((j->>'id')::uuid,(j->>'lease_token')::uuid,pg_temp.payload(j),encode(sha256(convert_to('%PDF-test','UTF8')),'hex'));
 perform public.record_quote_initial_acceptance((j->>'id')::uuid,(j->>'lease_token')::uuid,'provider-test-recovery');
 perform public.fail_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,'completion_failed',true);
end $$;
set local role authenticated;
do $$ declare j jsonb; next_j jsonb; begin
 select to_jsonb(x) into j from public.quote_initial_send_jobs x where quote_id='e4000000-0000-4000-8000-000000000005';
 perform pg_temp.assert(public.request_quote_initial_send('e4000000-0000-4000-8000-000000000005','client@example.test','Devis rejeté','Bonjour')->>'id'=j->>'id','Nonexplicit retry created a fresh email request');
 next_j:=public.request_quote_initial_send('e4000000-0000-4000-8000-000000000005','corrected@example.test','Devis corrigé','Bonjour corrigé',true);
 perform pg_temp.assert(next_j->>'id'<>j->>'id' and next_j->>'recipient_email'='corrected@example.test','Explicit known-failure retry did not create the corrected request');
 perform pg_temp.assert((select status='cancelled' from public.quote_initial_send_jobs where id=(j->>'id')::uuid),'Known-rejection retry retained the old active request');
end $$;
reset role;
update public.quote_initial_send_jobs set first_attempt_at=clock_timestamp()-interval '24 hours',lease_until=clock_timestamp()-interval '1 minute' where quote_id='e4000000-0000-4000-8000-000000000006';
-- Membership can change after provider acceptance. Completion must still be
-- possible without another provider POST or exposing the payload to browsers.
update public.company_members set role='owner' where company_id='e2000000-0000-4000-8000-000000000001' and user_id='e1000000-0000-4000-8000-000000000003';
delete from public.company_members where company_id='e2000000-0000-4000-8000-000000000001' and user_id='e1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ declare j jsonb; begin
 select public.claim_quote_initial_send(id,'e1000000-0000-4000-8000-000000000001') into j from public.quote_initial_send_jobs where quote_id='e4000000-0000-4000-8000-000000000006';
 perform pg_temp.assert((j->>'allowed')::boolean and j->>'provider_message_id'='provider-test-recovery' and (j->>'attempts')::integer=1,'Recorded acceptance could not recover after expiry/member removal');
 perform public.complete_quote_initial_send((j->>'id')::uuid,(j->>'lease_token')::uuid,j->>'provider_message_id');
 perform pg_temp.assert((select status='sent' from public.quote_initial_send_jobs where id=(j->>'id')::uuid),'Accepted request recovery did not complete');
end $$;
reset role;
insert into public.company_members(company_id,user_id,role) values('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','owner');
update public.company_members set role='member' where company_id='e2000000-0000-4000-8000-000000000001' and user_id='e1000000-0000-4000-8000-000000000003';
-- Detached and abandoned objects are swept; a tombstoned staging object cannot bind.
reset role;
update storage.objects set created_at=clock_timestamp()-interval '25 hours' where name=pg_temp.doc(10)->>'storage_path';
set local role service_role;
select * from public.claim_quote_document_cleanup();
reset role;
select pg_temp.assert((select count(*)=2 from public.quote_document_cleanup),'Cleanup missed retired/abandoned file or swept a bound file');
set local role authenticated;
do $$ begin
 begin perform public.attach_quote_document('e4000000-0000-4000-8000-000000000004',pg_temp.doc(10)); raise exception 'Ambiguous attachment replaced'; exception when check_violation then null; end;
 begin perform public.save_imported_quote('e4000000-0000-4000-8000-000000000010','e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',null,'EXPIRED-STAGING',1000,null,false,null,null,pg_temp.doc(10)); raise exception 'Tombstoned staging file bound'; exception when check_violation then null; end;
end $$;
set local role service_role;
do $$ declare c record; begin
 -- Inspect lease through postgres in the test only, not through a public grant.
 begin perform public.complete_quote_document_cleanup(gen_random_uuid(),gen_random_uuid()); raise exception 'Cleanup forged token accepted'; exception when check_violation then null; end;
end $$;
reset role;
do $$ declare c record; begin
 for c in select * from public.quote_document_cleanup loop
   perform public.complete_quote_document_cleanup(c.id,c.lease_token);
 end loop;
 perform pg_temp.assert((select count(*)=2 from public.quote_document_cleanup where status='done'),'Cleanup tombstones lost');
end $$;
rollback;
