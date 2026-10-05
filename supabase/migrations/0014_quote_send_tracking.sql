-- Extend only fresh email snapshots with a verified per-job client link and,
-- when configured, the quote's private reply route. Existing snapshots are immutable.
create function public.valid_quote_send_envelope(
  p_kind text,p_job_id uuid,p_quote_id uuid,p_company_id uuid,
  p_body text,p_original_reply text,p_payload jsonb
) returns boolean
language plpgsql security definer set search_path='' as $$
declare suffix text; url text; token text; actual_reply text;
begin
  actual_reply:=p_payload->>'reply_to';
  if actual_reply is null or not public.valid_followup_email(actual_reply) then return false; end if;
  if actual_reply is distinct from p_original_reply and not exists(
    select 1 from public.quote_email_reply_routes r where r.quote_id=p_quote_id and r.company_id=p_company_id
      and actual_reply=r.local_part||'@'||r.domain
  ) then return false; end if;
  -- Backward-compatible pre-upgrade workers retain their existing message format.
  if p_payload->>'text'=p_body then return true; end if;
  if p_body is null or jsonb_typeof(p_payload->'text') is distinct from 'string'
    or jsonb_typeof(p_payload->'html') is distinct from 'string'
    or left(p_payload->>'text',length(p_body))<>p_body then return false; end if;
  suffix:=substring(p_payload->>'text' from length(p_body)+1);
  if left(suffix,length(E'\n\nConsulter mon devis : '))<>E'\n\nConsulter mon devis : ' then return false; end if;
  url:=split_part(substring(suffix from length(E'\n\nConsulter mon devis : ')+1),E'\n',1);
  if url !~ '^https://(www\.)?cadova\.fr/devis/suivi#token=[A-Za-z0-9_-]{43}$'
    or suffix is distinct from E'\n\nConsulter mon devis : '||url||E'\n\nConsultez le PDF, posez une question ou indiquez votre décision.'
    or position('href="'||url||'"' in p_payload->>'html')=0 then return false; end if;
  token:=split_part(url,'#token=',2);
  return exists(select 1 from public.quote_client_links l
    where l.job_kind=p_kind and l.job_id=p_job_id and l.quote_id=p_quote_id and l.company_id=p_company_id
      and l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex')
      and l.revoked_at is null and l.expires_at>clock_timestamp());
end;
$$;
revoke all on function public.valid_quote_send_envelope(text,uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.persist_quote_followup_payload(p_job_id uuid,p_lease_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; reason text;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  reason:=public.quote_followup_block_reason(j.id);
  if reason is not null then raise exception 'Cet envoi a été arrêté.' using errcode='23514'; end if;
  if j.provider_payload is null then
    if not public.valid_followup_email(j.recipient_email) or not public.valid_followup_email(j.reply_to) or j.sender is null or j.subject is null or j.body is null
      or p_payload is null or jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>6
      or p_payload->>'from' is distinct from j.sender or p_payload->>'to' is distinct from j.recipient_email
      or p_payload->>'subject' is distinct from j.subject
      or not public.valid_quote_send_envelope('followup',j.id,j.quote_id,j.company_id,j.body,j.reply_to,p_payload)
      or jsonb_typeof(p_payload->'html') is distinct from 'string' or length(p_payload->>'html')>30000
      or length(p_payload->>'text')>13000 then raise exception 'Contenu d’envoi invalide.' using errcode='22023'; end if;
    update public.quote_followup_jobs set provider_payload=p_payload,first_attempt_at=clock_timestamp() where id=j.id;
    select * into j from public.quote_followup_jobs where id=j.id;
  end if;
  if j.first_attempt_at<clock_timestamp()-interval '23 hours' then raise exception 'Fenêtre de reprise expirée.' using errcode='23514'; end if;
  return jsonb_build_object('payload',j.provider_payload,'first_attempt_at',j.first_attempt_at);
end;
$$;
revoke all on function public.persist_quote_followup_payload(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_quote_followup_payload(uuid,uuid,jsonb) to service_role;

create or replace function public.persist_quote_initial_payload(p_job_id uuid,p_lease_token uuid,p_payload jsonb,p_attachment_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype; frozen jsonb; attachment jsonb; raw_bytes bytea; reason text;
begin
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if not found or j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  reason:=public.quote_initial_send_block_reason(j.id,j.requested_by);
  if reason is not null then raise exception 'Cet envoi n’est plus autorisé.' using errcode='23514'; end if;
  select payload into frozen from public.quote_initial_send_payloads where job_id=j.id;
  if frozen is null then
    if p_payload is null or jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>7
      or p_payload->>'to' is distinct from j.recipient_email or p_payload->>'subject' is distinct from j.subject
      or not public.valid_quote_send_envelope('initial',j.id,j.quote_id,j.company_id,j.body,j.reply_to,p_payload)
      or coalesce(length(p_payload->>'from'),0) not between 1 and 320 or p_payload->>'from' ~ E'[\\r\\n]'
      or jsonb_typeof(p_payload->'html') is distinct from 'string' or length(p_payload->>'html')>30000
      or length(p_payload->>'text')>5000
      or jsonb_typeof(p_payload->'attachments') is distinct from 'array' or jsonb_array_length(p_payload->'attachments')<>1
      or p_attachment_sha256 is null or p_attachment_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Contenu d’envoi invalide.' using errcode='22023'; end if;
    attachment:=p_payload->'attachments'->0;
    if jsonb_typeof(attachment)<>'object' or (select count(*) from jsonb_object_keys(attachment))<>3
      or attachment->>'filename' is distinct from j.file_name or attachment->>'content_type' is distinct from 'application/pdf'
      or jsonb_typeof(attachment->'content') is distinct from 'string' or length(attachment->>'content')>13981016 then raise exception 'Pièce jointe invalide.' using errcode='22023'; end if;
    begin raw_bytes:=decode(attachment->>'content','base64'); exception when others then raise exception 'Pièce jointe invalide.' using errcode='22023'; end;
    if octet_length(raw_bytes)<>j.size_bytes or substring(raw_bytes from 1 for 5)<>convert_to('%PDF-','UTF8')
      or encode(sha256(raw_bytes),'hex')<>p_attachment_sha256 then raise exception 'La pièce jointe ne correspond pas au PDF préparé.' using errcode='22023'; end if;
    insert into public.quote_initial_send_payloads(job_id,payload,attachment_sha256) values(j.id,p_payload,p_attachment_sha256);
    update public.quote_initial_send_jobs set first_attempt_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id returning * into j;
    frozen:=p_payload;
  end if;
  if j.first_attempt_at<=clock_timestamp()-interval '23 hours' then raise exception 'Fenêtre de reprise expirée.' using errcode='23514'; end if;
  return jsonb_build_object('payload',frozen,'first_attempt_at',j.first_attempt_at);
end;
$$;
revoke all on function public.persist_quote_initial_payload(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.persist_quote_initial_payload(uuid,uuid,jsonb,text) to service_role;

-- A transient portal/routing outage must not permanently stop the sequence.
-- Reuse the original five-attempt backoff; no provider request was made.
create or replace function public.fail_quote_followup_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_ambiguous boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; uncertain boolean; retryable boolean; retry_at timestamptz;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.lease_token is distinct from p_lease_token or j.status<>'processing' then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' or p_ambiguous is null then raise exception 'Code d’échec invalide.' using errcode='22023'; end if;
  uncertain:=j.ambiguous or p_ambiguous;
  retryable:=p_ambiguous or p_error_code in ('prepare_failed','client_link_unavailable','provider_rate_limited','provider_concurrent_request');
  update public.quote_followup_jobs set ambiguous=uncertain,last_error_code=p_error_code where id=j.id;
  if j.provider_message_id is not null then
    update public.quote_followup_jobs set status='queued',next_attempt_at=clock_timestamp()+interval '1 minute',lease_until=null where id=j.id;
  elsif not retryable or j.attempts>=5 or p_error_code in ('idempotency_window_expired','provider_payload_mismatch')
    or (j.first_attempt_at is not null and j.first_attempt_at<clock_timestamp()-interval '23 hours') then
    perform public.finalize_quote_followup_failure(j.id,case when uncertain then 'delivery_unknown' else 'failed' end,p_error_code);
  else
    retry_at:=clock_timestamp()+make_interval(secs=>least(3600,60*(2^(j.attempts-1))::integer));
    update public.quote_followup_jobs set status='queued',next_attempt_at=retry_at,lease_until=null,updated_at=clock_timestamp() where id=j.id;
    update public.quote_followup_automations set next_send_at=retry_at where quote_id=j.quote_id and enabled;
    update public.quote_followup_attempts set finished_at=clock_timestamp(),result='retry',error_code=p_error_code where job_id=j.id and attempt_number=j.attempts;
  end if;
end;
$$;
revoke all on function public.fail_quote_followup_job(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.fail_quote_followup_job(uuid,uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
