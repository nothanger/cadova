-- Disposable local database only; no network, inbox access or production data.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
insert into auth.users(id,email) values
 ('ea100000-0000-4000-8000-000000000001','email-owner@example.test'),
 ('ea100000-0000-4000-8000-000000000002','other-email-owner@example.test');
insert into public.companies(id,name) values
 ('ea200000-0000-4000-8000-000000000001','Email company'),
 ('ea200000-0000-4000-8000-000000000002','Other email company');
insert into public.company_members(company_id,user_id,role) values
 ('ea200000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000001','owner'),
 ('ea200000-0000-4000-8000-000000000002','ea100000-0000-4000-8000-000000000002','owner');
insert into public.clients(id,company_id,name,email) values
 ('ea300000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001','Client','client@example.test'),
 ('ea300000-0000-4000-8000-000000000002','ea200000-0000-4000-8000-000000000002','Other client','other@example.test');
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at) values
 ('ea400000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001','ea300000-0000-4000-8000-000000000001','EMAIL-1',1000,'sent',current_date),
 ('ea400000-0000-4000-8000-000000000002','ea200000-0000-4000-8000-000000000002','ea300000-0000-4000-8000-000000000002','EMAIL-2',1000,'sent',current_date);
insert into public.quote_followup_automations(quote_id,company_id,enabled,activated_by) values
 ('ea400000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001',true,'ea100000-0000-4000-8000-000000000001'),
 ('ea400000-0000-4000-8000-000000000002','ea200000-0000-4000-8000-000000000002',true,'ea100000-0000-4000-8000-000000000002');
insert into public.quote_followup_jobs(id,quote_id,company_id,generation,step,scheduled_at,next_attempt_at,status,lease_token,lease_until,recipient_email,reply_to) values
 ('ea500000-0000-4000-8000-000000000001','ea400000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001',0,1,now(),now(),'processing','ea600000-0000-4000-8000-000000000001',now()+interval '10 minutes','client@example.test','artisan@example.test'),
 ('ea500000-0000-4000-8000-000000000002','ea400000-0000-4000-8000-000000000002','ea200000-0000-4000-8000-000000000002',0,1,now(),now(),'processing','ea600000-0000-4000-8000-000000000002',now()+interval '10 minutes','other@example.test','other-artisan@example.test'),
 ('ea500000-0000-4000-8000-000000000003','ea400000-0000-4000-8000-000000000001','ea200000-0000-4000-8000-000000000001',0,2,now()+interval '12 days',now()+interval '12 days','queued',null,null,'client@example.test','artisan@example.test');
set local role service_role;
select pg_temp.assert(public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000001','replies.cadova.test') is null,'Disabled receiving replaced reply-to');
select public.set_quote_email_tracking_status(true,true);
create temporary table test_reply_addresses as select
 public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000001','replies.cadova.test') address,
 public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000002','ea600000-0000-4000-8000-000000000002','replies.cadova.test') other_address;
select pg_temp.assert((select address ~ '^q-[a-f0-9]{48}@replies.cadova.test$' and length(split_part(address,'@',1))<=64 and address<>other_address from test_reply_addresses),'Reply address exposes UUID or exceeds SMTP localpart');
select pg_temp.assert((select address=public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000001','replies.cadova.test') from test_reply_addresses),'Route unstable on retry');
do $$ begin
 begin perform public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000002','replies.cadova.test'); raise exception 'Wrong lease routed reply'; exception when check_violation then null; end;
 begin perform public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000001','replies.other.test'); raise exception 'Existing frozen route silently changed domain'; exception when check_violation then null; end;
end $$;
select pg_temp.assert(public.process_quote_email_delivery('msg-before-acceptance','email-provider-1','delivered',now())='unmatched','Unknown provider matched quote');
reset role;
update public.quote_followup_jobs set provider_message_id='email-provider-1',first_attempt_at=now()-interval '2 minutes' where id='ea500000-0000-4000-8000-000000000001';
update public.quote_followup_jobs set provider_message_id='email-provider-2' where id='ea500000-0000-4000-8000-000000000002';
select pg_temp.assert((select status='accepted' from public.quote_email_deliveries where provider_message_id='email-provider-1'),'Acceptance falsely marked delivery');
do $$ begin
 begin update public.quote_followup_jobs set provider_message_id='email-provider-1' where id='ea500000-0000-4000-8000-000000000002'; raise exception 'One provider ID correlated to two tenants'; exception when unique_violation then null; end;
end $$;
set local role service_role;
select pg_temp.assert(public.process_quote_email_delivery('msg-before-acceptance','email-provider-1','delivered',now())='applied','Retry after acceptance lost delivery');
select pg_temp.assert(public.process_quote_email_delivery('msg-before-acceptance','email-provider-1','bounced',now())='duplicate','Event replay rewrote delivery');
select pg_temp.assert(public.process_quote_email_delivery('msg-delay-late','email-provider-1','delayed',now()+interval '10 seconds')='applied','Out-of-order event handling failed');
select pg_temp.assert((select status='delivered' from public.quote_email_deliveries where provider_message_id='email-provider-1'),'Delay downgraded delivered');
select pg_temp.assert(public.process_quote_email_delivery('msg-bounce','email-provider-1','bounced',now())='applied','Bounce not applied');
select pg_temp.assert(public.process_quote_email_delivery('msg-delivered-late','email-provider-1','delivered',now()-interval '1 hour')='applied','Old delivered event handling failed');
select pg_temp.assert((select status='bounced' from public.quote_email_deliveries where provider_message_id='email-provider-1'),'Old delivered event revived failed email');
select pg_temp.assert((select enabled=false and stop_reason='delivery_failed' from public.quote_followup_automations where quote_id='ea400000-0000-4000-8000-000000000001'),'Bounce left automation enabled');
select pg_temp.assert((select enabled from public.quote_followup_automations where quote_id='ea400000-0000-4000-8000-000000000002'),'Bounce stopped other tenant');
select pg_temp.assert(public.process_quote_email_delivery('msg-complaint','email-provider-1','complained',now())='applied','Complaint not applied');
select pg_temp.assert((select stop_reason='email_complained' from public.quote_followup_automations where quote_id='ea400000-0000-4000-8000-000000000001'),'Complaint did not stop future emails');
-- A valid route alone cannot attribute a third party's response to a customer.
select pg_temp.assert(public.record_quote_email_reply('reply-bad-sender','incoming-bad',address,'attacker@example.test','Faux message',now())='ignored','Unknown sender stopped automation') from test_reply_addresses;
select pg_temp.assert(public.record_quote_email_reply('reply-cross-company','incoming-cross',other_address,'client@example.test','Mauvais devis',now())='ignored','Client crossed tenant using another route') from test_reply_addresses;
select pg_temp.assert(public.record_quote_email_reply('reply-other','incoming-valid',other_address,'other@example.test',E'Bonjour,\nmerci de préciser le délai.',now(),'{"in-reply-to":"<known>"}')='applied','Known customer response not recorded') from test_reply_addresses;
select pg_temp.assert(public.record_quote_email_reply('reply-other','incoming-valid',other_address,'other@example.test','Repeated',now())='duplicate','Provider event duplicate created second response') from test_reply_addresses;
select pg_temp.assert(public.record_quote_email_reply('reply-new-event-same-email','incoming-valid',other_address,'other@example.test','Repeated',now())='duplicate','Provider email duplicate created second response') from test_reply_addresses;
reset role;
select pg_temp.assert((select count(*)=1 from public.quote_email_replies),'Response duplicated or invalid sender inserted');
select pg_temp.assert((select enabled=false and stop_reason='response_received' from public.quote_followup_automations where quote_id='ea400000-0000-4000-8000-000000000002'),'Email response did not atomically stop automation');
select pg_temp.assert((select count(*)=1 from public.quote_events where email_reply_id is not null and event_type='response'),'Response history not atomic');
select pg_temp.assert((select count(*)=1 from public.quote_client_messages where quote_id='ea400000-0000-4000-8000-000000000002' and author='client'),'Plain email response missing from client conversation');
select pg_temp.assert((select count(*)=1 from public.notifications where type='quote_email_response' and company_id='ea200000-0000-4000-8000-000000000002' and user_id='ea100000-0000-4000-8000-000000000002'),'Response notification missing/duplicated/foreign');
-- Company reads are tenant scoped; protected facts and routes cannot be forged.
set local role authenticated;
select set_config('request.jwt.claim.sub','ea100000-0000-4000-8000-000000000001',true);
select pg_temp.assert((select count(*)=1 from public.quote_email_deliveries),'Delivery RLS exposed another tenant');
select pg_temp.assert(not exists(select 1 from public.quote_email_replies),'Reply RLS exposed another tenant');
select pg_temp.assert((public.read_quote_email_tracking_status()->>'receivingReady')::boolean,'Configured status unavailable');
do $$ declare affected integer; begin
 begin perform public.process_quote_email_delivery('forged','email-provider-1','delivered',now()); raise exception 'Browser forged delivery'; exception when insufficient_privilege then null; end;
 begin perform public.record_quote_email_reply('forged','incoming-forged','random@example.test','client@example.test','Forged',now()); raise exception 'Browser forged incoming response'; exception when insufficient_privilege then null; end;
 begin perform public.ensure_quote_send_reply_address('followup','ea500000-0000-4000-8000-000000000001','ea600000-0000-4000-8000-000000000001','replies.cadova.test'); raise exception 'Browser enumerated route'; exception when insufficient_privilege then null; end;
 begin select * from public.quote_email_reply_routes; raise exception 'Browser read private routes'; exception when insufficient_privilege then null; end;
 begin select * from public.quote_email_provider_events; raise exception 'Browser read provider registry'; exception when insufficient_privilege then null; end;
 begin insert into public.quote_events(company_id,quote_id,event_type,content,email_delivery_id) select company_id,quote_id,'note','Forged',id from public.quote_email_deliveries limit 1; raise exception 'Browser forged protected timeline'; exception when insufficient_privilege then null; end;
 update public.quote_events set content='Changed' where email_delivery_id is not null; get diagnostics affected=row_count; perform pg_temp.assert(affected=0,'Browser rewrote delivery history');
 delete from public.quote_events where email_delivery_id is not null; get diagnostics affected=row_count; perform pg_temp.assert(affected=0,'Browser deleted delivery history');
end $$;
select set_config('request.jwt.claim.sub','ea100000-0000-4000-8000-000000000002',true);
select pg_temp.assert((select count(*)=1 from public.quote_email_replies),'Own response missing');
do $$ declare affected integer; begin
 delete from public.quote_events where email_reply_id is not null; get diagnostics affected=row_count; perform pg_temp.assert(affected=0,'Browser removed automatic response and allowed reactivation');
end $$;
set local role anon;
do $$ begin
 begin select * from public.quote_email_deliveries; raise exception 'Anonymous read delivery data'; exception when insufficient_privilege then null; end;
 begin perform public.read_quote_email_tracking_status(); raise exception 'Anonymous inspected internal status'; exception when insufficient_privilege then null; end;
end $$;
rollback;
