-- Local disposable database only; no external mail or real customer data.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
insert into public.companies(id,name) values
 ('f2000000-0000-4000-8000-000000000001','Sender tracking A'),
 ('f2000000-0000-4000-8000-000000000002','Sender tracking B');
insert into public.clients(id,company_id,name,email) values
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Client A','client-a@example.test'),
 ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','Client B','client-b@example.test');
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at) values
 ('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','TRACK-A',10000,'sent',current_date),
 ('f4000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000002','TRACK-B',10000,'sent',current_date);
insert into public.quote_client_links(company_id,quote_id,token_hash,expires_at,job_kind,job_id) values
 ('f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001',encode(sha256(convert_to(repeat('a',43),'UTF8')),'hex'),clock_timestamp()+interval '1 day','initial','f5000000-0000-4000-8000-000000000001'),
 ('f2000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000002',encode(sha256(convert_to(repeat('b',43),'UTF8')),'hex'),clock_timestamp()+interval '1 day','followup','f5000000-0000-4000-8000-000000000002');
insert into public.quote_email_reply_routes(quote_id,company_id,local_part,domain) values
 ('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','q-'||repeat('a',48),'replies.cadova.fr'),
 ('f4000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','q-'||repeat('b',48),'replies.cadova.fr');
do $$
declare payload jsonb; url text:='https://www.cadova.fr/devis/suivi#token='||repeat('a',43); body text:='Bonjour, voici le devis.';
  job uuid:='f5000000-0000-4000-8000-000000000001'; quote uuid:='f4000000-0000-4000-8000-000000000001'; tenant uuid:='f2000000-0000-4000-8000-000000000001';
begin
  payload:=jsonb_build_object('reply_to','contact@example.test','text',body,'html','<p>Ancien message</p>');
  perform pg_temp.assert(public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',payload),'Legacy payload compatibility broken');
  payload:=jsonb_set(payload,'{text}',to_jsonb(body||E'\n\nConsulter mon devis : '||url||E'\n\nConsultez le PDF, posez une question ou indiquez votre décision.'));
  payload:=jsonb_set(payload,'{html}',to_jsonb('<a href="'||url||'">Consulter mon devis</a>'));
  perform pg_temp.assert(public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',payload),'Valid per-job portal envelope rejected');
  payload:=jsonb_set(payload,'{reply_to}',to_jsonb('q-'||repeat('a',48)||'@replies.cadova.fr'));
  perform pg_temp.assert(public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',payload),'Same-quote reply route rejected');
  perform pg_temp.assert(not public.valid_quote_send_envelope('followup',job,quote,tenant,body,'contact@example.test',payload),'Link shared between initial/followup namespaces');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial','f5000000-0000-4000-8000-000000000009',quote,tenant,body,'contact@example.test',payload),'Link shared between jobs');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,'f4000000-0000-4000-8000-000000000002',tenant,body,'contact@example.test',payload),'Link shared between quotes');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,'f2000000-0000-4000-8000-000000000002',body,'contact@example.test',payload),'Link or route shared between tenants');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',jsonb_set(payload,'{reply_to}',to_jsonb('q-'||repeat('b',48)||'@replies.cadova.fr'))),'Other-tenant reply route accepted');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',jsonb_set(payload,'{reply_to}','"attacker@example.test"')),'Arbitrary reply address accepted');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',jsonb_set(payload,'{text}',to_jsonb(replace(payload->>'text','www.cadova.fr','evil.test')))),'External link accepted');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',jsonb_set(payload,'{html}',to_jsonb(replace(payload->>'html','www.cadova.fr','evil.test')))),'HTML destination differed from plain text');
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',jsonb_set(payload,'{text}',to_jsonb(payload->>'text'||' injected'))),'Message body rewritten after snapshot');
  update public.quote_client_links set revoked_at=clock_timestamp() where job_id=job;
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',payload),'Revoked link accepted in fresh snapshot');
  update public.quote_client_links set revoked_at=null,expires_at=clock_timestamp()-interval '1 second' where job_id=job;
  perform pg_temp.assert(not public.valid_quote_send_envelope('initial',job,quote,tenant,body,'contact@example.test',payload),'Expired link accepted in fresh snapshot');
end $$;
insert into public.quote_followup_jobs(id,quote_id,company_id,generation,step,scheduled_at,next_attempt_at,status,attempts,lease_token,lease_until)
  values('f5000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002',1,1,clock_timestamp(),clock_timestamp(),'processing',1,'f6000000-0000-4000-8000-000000000001',clock_timestamp()+interval '3 minutes');
select public.fail_quote_followup_job('f5000000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000001','client_link_unavailable',false);
select pg_temp.assert((select status='queued' and not ambiguous and next_attempt_at>clock_timestamp() and first_attempt_at is null and provider_message_id is null and provider_payload is null from public.quote_followup_jobs where id='f5000000-0000-4000-8000-000000000002'),'Portal outage was not retried with existing safe backoff');
update public.quote_followup_jobs set status='processing',attempts=5,lease_until=clock_timestamp()+interval '3 minutes' where id='f5000000-0000-4000-8000-000000000002';
select public.fail_quote_followup_job('f5000000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000001','client_link_unavailable',false);
select pg_temp.assert((select status='failed' and not ambiguous and provider_message_id is null and provider_payload is null from public.quote_followup_jobs where id='f5000000-0000-4000-8000-000000000002'),'Portal outage exceeded five-attempt limit');
do $$ begin
  perform pg_temp.assert(not has_function_privilege('anon','public.valid_quote_send_envelope(text,uuid,uuid,uuid,text,text,jsonb)','execute'),'Envelope helper exposed to anon');
  perform pg_temp.assert(not has_function_privilege('authenticated','public.valid_quote_send_envelope(text,uuid,uuid,uuid,text,text,jsonb)','execute'),'Envelope helper exposed to user');
  perform pg_temp.assert(not has_function_privilege('service_role','public.valid_quote_send_envelope(text,uuid,uuid,uuid,text,text,jsonb)','execute'),'Internal helper unnecessarily exposed to service RPC');
end $$;
rollback;
