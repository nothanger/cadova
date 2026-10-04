-- Disposable database only. No HTTP request and no real email is made here.
begin;
set local time zone 'Europe/Paris';
insert into auth.users(id,email) values
  ('b1000000-0000-4000-8000-000000000001','automation-owner@example.test'),
  ('b1000000-0000-4000-8000-000000000002','other-owner@example.test'),
  ('b1000000-0000-4000-8000-000000000003','automation-admin@example.test'),
  ('b1000000-0000-4000-8000-000000000004','automation-member@example.test');
insert into public.platform_admins(user_id) values('b1000000-0000-4000-8000-000000000003');
insert into public.companies(id,name) values
  ('b2000000-0000-4000-8000-000000000001','Entreprise A'),
  ('b2000000-0000-4000-8000-000000000002','Entreprise B');
insert into public.company_members(company_id,user_id,role) values
  ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','owner'),
  ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','owner'),
  ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','member');
insert into public.clients(id,company_id,name,email) values
  ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Client A','client@example.test'),
  ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Client B','other-client@example.test'),
  ('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','Sans email',null);
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at)
  select ('b4000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001','AUTO-'||g,125050,'sent',current_date-20 from generate_series(1,16)g;
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at) values
  ('b5000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','OTHER',10000,'sent',current_date-20),
  ('b5000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000003','NO-EMAIL',10000,'sent',current_date-20);

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
do $$
declare bad_email text;
begin
  if (public.read_quote_followup_service_status()->>'ready')::boolean then raise exception 'Service unexpectedly ready by default'; end if;
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000001',true); raise exception 'Enabled without server configuration'; exception when check_violation then null; end;
  begin perform public.set_quote_followup_service_status(true,true,'ready'); raise exception 'Client forged ready state'; exception when insufficient_privilege then null; end;
  begin perform public.claim_quote_followup_jobs(); raise exception 'Client claimed worker job'; exception when insufficient_privilege then null; end;
  foreach bad_email in array array['bad','foo..bar@example.test','.foo@example.test','foo.@example.test','x@foo-.test','x@foo..test',E'x@example.test\nBcc:bad@example.test'] loop
    begin perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000001',bad_email); raise exception 'Invalid email accepted'; exception when invalid_parameter_value then null; end;
  end loop;
  perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','contact@example.test');
  begin perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000002','forged@example.test'); raise exception 'Cross-company email settings allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_quote_followup_automation('b5000000-0000-4000-8000-000000000001',false); raise exception 'Cross-company automation allowed'; exception when insufficient_privilege then null; end;
  begin
    insert into public.quote_events(company_id,quote_id,event_type,created_by) values('b2000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','response',auth.uid());
    raise exception 'Cross-company response stopped another tenant quote';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.quote_events(company_id,quote_id,event_type,created_by,delivery_status) values('b2000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','followup_auto_sent',auth.uid(),'sent');
    raise exception 'Client forged automatic sent event';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role service_role;
select public.set_quote_followup_service_status(false,false,'email_configuration_missing');
select public.set_quote_followup_service_status(true,true,'ready');
set local role authenticated;
do $$
declare state jsonb;
begin
  state:=public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000001',true,5,12,'Suivi {{ quote_reference }}','Bonjour {{ client_name }}, devis de {{amount_formatted}} chez {{company_name}}.');
  if (state->>'generation')::integer<>1 or not(state->>'enabled')::boolean then raise exception 'Opt-in failed'; end if;
  if (state->>'next_send_at')::timestamptz at time zone 'Europe/Paris' <> (current_date+1+time '09:00') then raise exception 'Old quote default not safely postponed'; end if;
  if (select count(*) from public.quote_followup_jobs where quote_id='b4000000-0000-4000-8000-000000000001')<>2 then raise exception 'Default calendar did not have exactly two steps'; end if;
  perform public.set_quote_followup_automation_paused('b4000000-0000-4000-8000-000000000001',true);
  state:=public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000001',true,5,12,'Suivi {{quote_reference}}','Bonjour {{client_name}}, devis de {{amount_formatted}} chez {{company_name}}.');
  if not(state->>'paused')::boolean then raise exception 'Saving settings implicitly resumed automation'; end if;
  perform public.set_quote_followup_automation_paused('b4000000-0000-4000-8000-000000000001',false);
  begin perform public.save_quote_followup_automation('b5000000-0000-4000-8000-000000000002',true); raise exception 'Missing client email allowed'; exception when check_violation then null; end;
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000002',true,12,5); raise exception 'Reversed delays allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000002',true,5,12,'Unknown {{password}}','Test'); raise exception 'Unknown template variable allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000002',true,5,12,E'Bad\nSubject','Test'); raise exception 'Subject header injection allowed'; exception when invalid_parameter_value then null; end;
end;
$$;
reset role;
update public.quote_followup_jobs set scheduled_at=clock_timestamp()-interval '1 minute',next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000001' and status='queued' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb; saved jsonb; changed jsonb; payload jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  if claim.id is null or claim.attempts<>1 then raise exception 'Due job not claimed'; end if;
  if (select count(*) from public.claim_quote_followup_jobs())<>0 then raise exception 'Processing lease claimed twice'; end if;
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  if not(prepared->>'allowed')::boolean or prepared->>'recipient_email'<>'client@example.test' then raise exception 'Wrong prepared recipient'; end if;
  if prepared->>'body' not like '%1250,50 €%' then raise exception 'Amount placeholder not rendered'; end if;
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Original exact HTML</p>');
  saved:=public.persist_quote_followup_payload(claim.id,claim.lease_token,payload);
  changed:=public.persist_quote_followup_payload(claim.id,claim.lease_token,jsonb_set(payload,'{html}','"<p>New deployment HTML</p>"'));
  if saved->'payload'<>changed->'payload' or saved->'first_attempt_at'<>changed->'first_attempt_at' then raise exception 'Retry payload or clock changed'; end if;
  perform public.record_quote_followup_provider_acceptance(claim.id,claim.lease_token,'provider-first');
  perform public.complete_quote_followup_job(claim.id,claim.lease_token,'provider-first');
  perform public.complete_quote_followup_job(claim.id,claim.lease_token,'provider-first');
  if (select count(*) from public.quote_events where automation_job_id=claim.id and delivery_status='sent')<>1 then raise exception 'Completion event duplicated'; end if;
  if (select count(*) from public.notifications where automation_job_id=claim.id)<>1 then raise exception 'Completion notification duplicated'; end if;
  if (select next_send_at from public.quote_followup_automations where quote_id='b4000000-0000-4000-8000-000000000001')<clock_timestamp()+interval '6 days' then raise exception 'Late first send caused rapid second send'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set scheduled_at=clock_timestamp()-interval '1 minute',next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000001' and status='queued' and step=2;
set local role service_role;
do $$
declare claim record; prepared jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  perform public.persist_quote_followup_payload(claim.id,claim.lease_token,jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Second</p>'));
  perform public.complete_quote_followup_job(claim.id,claim.lease_token,'provider-second');
end;
$$;
set local role authenticated;
do $$
declare state jsonb; affected integer;
begin
  state:=public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000001');
  if (state->>'enabled')::boolean or state->>'stop_reason'<>'completed' then raise exception 'Sequence did not stop after second send'; end if;
  state:=public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000001',true);
  if (state->>'enabled')::boolean then raise exception 'Config edit restarted completed steps'; end if;
  if (select count(*) from public.quote_followup_jobs where quote_id='b4000000-0000-4000-8000-000000000001' and status='sent')<>2 then raise exception 'Sequence sent more than twice'; end if;
  update public.quote_events set content='Forged' where automation_job_id is not null;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Client rewrote automatic history'; end if;
  begin update public.quote_followup_jobs set status='sent'; raise exception 'Client forged job status'; exception when insufficient_privilege then null; end;
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000002',true);
  update public.quotes set status='accepted' where id='b4000000-0000-4000-8000-000000000002';
  if (public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000002')->>'enabled')::boolean then raise exception 'Accepted quote still enabled'; end if;
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000003',true);
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by) values('b2000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000003','note','Just a note',auth.uid());
  if not(public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000003')->>'enabled')::boolean then raise exception 'Note incorrectly stopped automation'; end if;
  perform public.record_quote_response('b4000000-0000-4000-8000-000000000003','Client a répondu.');
  delete from public.quote_events where quote_id='b4000000-0000-4000-8000-000000000003' and event_type='response';
  if (public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000003')->>'enabled')::boolean then raise exception 'Deleting response implicitly resumed automation'; end if;
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000004',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000005',true);
end;
$$;
reset role;
update public.quote_followup_jobs set scheduled_at=clock_timestamp()-interval '1 minute',next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000004' and step=1 and status='queued';
set local role service_role;
do $$
declare claim record;
begin
  select * into claim from public.claim_quote_followup_jobs();
  set local role authenticated;
  perform public.set_quote_followup_automation_paused('b4000000-0000-4000-8000-000000000004',true);
  set local role service_role;
  if (public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>')->>'allowed')::boolean then raise exception 'Pause between claim and prepare was ignored'; end if;
  if (select status from public.quote_followup_jobs where id=claim.id)<>'queued' then raise exception 'Paused job was destroyed instead of retained'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set scheduled_at=clock_timestamp()-interval '1 minute',next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000005' and step=1 and status='queued';
set local role service_role;
do $$
declare claim record; prepared jsonb; payload jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Ambiguous original</p>');
  perform public.persist_quote_followup_payload(claim.id,claim.lease_token,payload);
  perform public.fail_quote_followup_job(claim.id,claim.lease_token,'provider_timeout',true);
  update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute' where id=claim.id;
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'New deployment <other@cadova.fr>');
  if prepared->>'sender'<>'Cadova <relances@cadova.fr>' or prepared->'provider_payload'<>payload then raise exception 'Provider retry changed snapshot'; end if;
  perform public.fail_quote_followup_job(claim.id,claim.lease_token,'provider_timeout',true);
  update public.quote_followup_jobs set first_attempt_at=clock_timestamp()-interval '24 hours',next_attempt_at=clock_timestamp()-interval '1 minute' where id=claim.id;
  if (select count(*) from public.claim_quote_followup_jobs())<>0 then raise exception 'Ambiguous email resent beyond safe window'; end if;
  if (select status from public.quote_followup_jobs where id=claim.id)<>'delivery_unknown' then raise exception 'Ambiguous final result reported as unsent'; end if;
end;
$$;
set local role authenticated;
do $$
begin
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000005',true); raise exception 'Unknown delivery restarted with new job/key'; exception when check_violation then null; end;
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000005',false);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000008',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000009',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000010',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000011',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000012',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000013',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000015',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000016',true);
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000008' and step=1;
set local role service_role;
do $$
declare previous record; current_claim record; prepared jsonb; payload jsonb;
begin
  select * into previous from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(previous.id,previous.lease_token,'Cadova <relances@cadova.fr>');
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Lease fencing</p>');
  update public.quote_followup_jobs set lease_until=clock_timestamp()-interval '1 second' where id=previous.id;
  select * into current_claim from public.claim_quote_followup_jobs();
  if current_claim.id<>previous.id or current_claim.lease_token=previous.lease_token or current_claim.attempts<>2 then raise exception 'Expired lease was not fenced'; end if;
  begin perform public.prepare_quote_followup_send(previous.id,previous.lease_token,'Cadova <relances@cadova.fr>'); raise exception 'Stale lease prepared'; exception when check_violation then null; end;
  begin perform public.persist_quote_followup_payload(previous.id,previous.lease_token,payload); raise exception 'Stale lease persisted'; exception when check_violation then null; end;
  begin perform public.record_quote_followup_provider_acceptance(previous.id,previous.lease_token,'stale'); raise exception 'Stale lease recorded acceptance'; exception when check_violation then null; end;
  begin perform public.complete_quote_followup_job(previous.id,previous.lease_token,'stale'); raise exception 'Stale lease completed'; exception when check_violation then null; end;
  begin perform public.fail_quote_followup_job(previous.id,previous.lease_token,'prepare_failed'); raise exception 'Stale lease failed current worker'; exception when check_violation then null; end;
  perform public.persist_quote_followup_payload(current_claim.id,current_claim.lease_token,payload);
  perform public.complete_quote_followup_job(current_claim.id,current_claim.lease_token,'fenced-current');
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000009' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  perform public.persist_quote_followup_payload(claim.id,claim.lease_token,jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Accepted before response</p>'));
  perform public.record_quote_followup_provider_acceptance(claim.id,claim.lease_token,'accepted-before-response');
  set local role authenticated;
  perform public.record_quote_response('b4000000-0000-4000-8000-000000000009','Réponse après acceptation par le service email.');
  set local role service_role;
  perform public.fail_quote_followup_job(claim.id,claim.lease_token,'provider_completion_failed',true);
  update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute' where id=claim.id;
  select * into claim from public.claim_quote_followup_jobs();
  if claim.provider_message_id<>'accepted-before-response' or claim.attempts<>1 then raise exception 'Accepted mail was resent or lost after response'; end if;
  perform public.complete_quote_followup_job(claim.id,claim.lease_token,claim.provider_message_id);
  perform public.complete_quote_followup_job(claim.id,claim.lease_token,claim.provider_message_id);
  if (select count(*) from public.quote_events where automation_job_id=claim.id and delivery_status='sent')<>1 then raise exception 'Accepted mail did not have exactly one truthful event'; end if;
  if (select count(*) from public.quote_followup_jobs where quote_id='b4000000-0000-4000-8000-000000000009' and status='queued')<>0
    or (select enabled from public.quote_followup_automations where quote_id='b4000000-0000-4000-8000-000000000009') then raise exception 'Accepted completion restarted stopped sequence'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000010' and step=1;
set local role authenticated;
select public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','contact@example.test',true);
set local role service_role;
do $$ begin
  if (select count(*) from public.claim_quote_followup_jobs())<>0 then raise exception 'Company-wide pause ignored'; end if;
  if not(select enabled from public.quote_followup_automations where quote_id='b4000000-0000-4000-8000-000000000010') then raise exception 'Company pause permanently stopped sequence'; end if;
end $$;
set local role authenticated;
select public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','contact@example.test',false);
set local role service_role;
select public.set_quote_followup_service_status(false,true,'disabled');
do $$ begin if (select count(*) from public.claim_quote_followup_jobs())<>0 then raise exception 'Server disabled switch ignored'; end if; end $$;
select public.set_quote_followup_service_status(true,true,'ready');
do $$
declare claim record; prepared jsonb; payload jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Stopped before dispatch</p>');
  set local role authenticated;
  perform public.record_quote_response('b4000000-0000-4000-8000-000000000010','Réponse reçue avant l’envoi.');
  set local role service_role;
  begin perform public.persist_quote_followup_payload(claim.id,claim.lease_token,payload); raise exception 'Response between prepare and persist ignored'; exception when check_violation then null; end;
  if (public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>')->>'allowed')::boolean then raise exception 'Stopped mail allowed dispatch'; end if;
  if (select first_attempt_at from public.quote_followup_jobs where id=claim.id) is not null then raise exception 'Stopped mail recorded a dispatch'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000011' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  perform public.persist_quote_followup_payload(claim.id,claim.lease_token,jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Rejected</p>'));
  perform public.fail_quote_followup_job(claim.id,claim.lease_token,'provider_rejected',false);
  if (select status from public.quote_followup_jobs where id=claim.id)<>'failed'
    or (select stop_reason from public.quote_followup_automations where quote_id='b4000000-0000-4000-8000-000000000011')<>'delivery_failed'
    or (select count(*) from public.quote_events where automation_job_id=claim.id and delivery_status='failed')<>1 then raise exception 'Certain failure not final or not journalled'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000012' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  perform public.persist_quote_followup_payload(claim.id,claim.lease_token,jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Payload conflict</p>'));
  perform public.fail_quote_followup_job(claim.id,claim.lease_token,'provider_payload_mismatch',true);
  if (select status from public.quote_followup_jobs where id=claim.id)<>'delivery_unknown'
    or (select attempts from public.quote_followup_jobs where id=claim.id)<>1 then raise exception 'Payload conflict was automatically retried'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000013' and step=1;
set local role service_role;
do $$
declare claim record; iteration integer;
begin
  for iteration in 1..5 loop
    select * into claim from public.claim_quote_followup_jobs();
    if claim.attempts<>iteration then raise exception 'Retry attempt counter inconsistent'; end if;
    perform public.fail_quote_followup_job(claim.id,claim.lease_token,'prepare_failed',false);
    if iteration<5 then
      if (select next_attempt_at from public.quote_followup_jobs where id=claim.id)<=clock_timestamp() then raise exception 'Retry had no backoff'; end if;
      update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute' where id=claim.id;
    end if;
  end loop;
  if (select status from public.quote_followup_jobs where id=claim.id)<>'failed'
    or (select count(*) from public.quote_followup_attempts where job_id=claim.id and finished_at is not null)<>5 then raise exception 'Safe retries not bounded and journalled'; end if;
end;
$$;
-- An address changed after preparation must block even the first dispatch.
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000015' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb; payload jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Changed address</p>');
  set local role authenticated;
  update public.clients set email='changed@example.test' where id='b3000000-0000-4000-8000-000000000001';
  set local role service_role;
  begin perform public.persist_quote_followup_payload(claim.id,claim.lease_token,payload); raise exception 'Changed client address accepted before first dispatch'; exception when check_violation then null; end;
  if (public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>')->>'allowed')::boolean then raise exception 'Old recipient sent after address change'; end if;
  set local role authenticated;
  update public.clients set email='client@example.test' where id='b3000000-0000-4000-8000-000000000001';
end;
$$;
reset role;
update public.quote_followup_jobs set next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000016' and step=1;
set local role service_role;
do $$
declare claim record; prepared jsonb; payload jsonb;
begin
  select * into claim from public.claim_quote_followup_jobs();
  prepared:=public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>');
  payload:=jsonb_build_object('from',prepared->>'sender','to',prepared->>'recipient_email','reply_to',prepared->>'reply_to','subject',prepared->>'subject','text',prepared->>'body','html','<p>Changed reply-to</p>');
  set local role authenticated;
  perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','changed-contact@example.test');
  set local role service_role;
  begin perform public.persist_quote_followup_payload(claim.id,claim.lease_token,payload); raise exception 'Changed reply-to accepted before first dispatch'; exception when check_violation then null; end;
  if (public.prepare_quote_followup_send(claim.id,claim.lease_token,'Cadova <relances@cadova.fr>')->>'allowed')::boolean then raise exception 'Old reply-to sent after contact change'; end if;
  set local role authenticated;
  perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','contact@example.test');
end;
$$;
set local role authenticated;
do $$
begin
  begin perform public.prepare_quote_followup_send(gen_random_uuid(),gen_random_uuid(),'forged'); raise exception 'Client prepared email'; exception when insufficient_privilege then null; end;
  begin perform public.persist_quote_followup_payload(gen_random_uuid(),gen_random_uuid(),'{}'); raise exception 'Client persisted payload'; exception when insufficient_privilege then null; end;
  begin perform public.record_quote_followup_provider_acceptance(gen_random_uuid(),gen_random_uuid(),'forged'); raise exception 'Client recorded provider acceptance'; exception when insufficient_privilege then null; end;
  begin perform public.complete_quote_followup_job(gen_random_uuid(),gen_random_uuid(),'forged'); raise exception 'Client completed email'; exception when insufficient_privilege then null; end;
  begin perform public.fail_quote_followup_job(gen_random_uuid(),gen_random_uuid(),'prepare_failed'); raise exception 'Client failed email'; exception when insufficient_privilege then null; end;
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000006',true);
  perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000007',true);
  update public.quotes set expires_at=current_date where id='b4000000-0000-4000-8000-000000000007';
  if (public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000007')->>'enabled')::boolean then raise exception 'Expired quote remained enabled'; end if;
end;
$$;
reset role;
update public.quote_followup_jobs set scheduled_at=clock_timestamp()-interval '1 minute',next_attempt_at=clock_timestamp()-interval '1 minute'
  where quote_id='b4000000-0000-4000-8000-000000000006' and step=1 and status='queued';
update auth.users set banned_until=now()+interval '1 day' where id='b1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
begin if (select count(*) from public.claim_quote_followup_jobs())<>0 then raise exception 'Suspended actor job was taken'; end if; end;
$$;
set local role authenticated;
do $$
begin
  if (select count(*) from public.quote_followup_jobs)<>0 then raise exception 'Suspended actor can read automation journal'; end if;
  begin perform public.get_quote_followup_automation('b4000000-0000-4000-8000-000000000006'); raise exception 'Suspended actor can read automation'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
update auth.users set banned_until=null where id='b1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
do $$
begin if (select count(*) from public.quote_followup_jobs)<>0 then raise exception 'Other company can read private email payloads'; end if; end;
$$;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
do $$
begin
  if exists(select 1 from public.company_members where user_id=auth.uid()) then raise exception 'Admin fixture unexpectedly has company membership'; end if;
  perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000002','admin-contact@example.test');
  perform public.save_quote_followup_automation('b5000000-0000-4000-8000-000000000001',true);
  if (select count(*) from public.quote_followup_jobs where company_id='b2000000-0000-4000-8000-000000000002')<>2 then raise exception 'Global administrator could not configure another company'; end if;
  perform public.admin_delete_company('b2000000-0000-4000-8000-000000000002','Entreprise B');
  if exists(select 1 from public.quote_followup_jobs where company_id='b2000000-0000-4000-8000-000000000002')
    or exists(select 1 from public.quote_followup_automations where company_id='b2000000-0000-4000-8000-000000000002')
    or exists(select 1 from public.company_email_settings where company_id='b2000000-0000-4000-8000-000000000002') then raise exception 'Company deletion left email automation data'; end if;
  if not exists(select 1 from public.platform_admins where user_id=auth.uid()) then raise exception 'Company deletion affected administrator identity'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
do $$
begin
  begin perform public.set_company_email_settings('b2000000-0000-4000-8000-000000000001','member-forged@example.test'); raise exception 'Ordinary member changed reply-to'; exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$
begin
  begin perform public.save_quote_followup_automation('b4000000-0000-4000-8000-000000000001',false); raise exception 'Anonymous configured automation'; exception when insufficient_privilege then null; end;
  begin perform public.claim_quote_followup_jobs(); raise exception 'Anonymous claimed automation'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
