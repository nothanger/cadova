-- Keep client decisions, the communicated quote summary and user corrections
-- consistent without changing the existing send/automation worker contracts.

create or replace function public.use_quote_client_link(
  p_token_hash text,p_action text,p_kind text default null,p_message text default null,p_nonce uuid default null,p_confirmed boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.quote_client_links%rowtype; q public.quotes%rowtype; existing public.quote_client_messages%rowtype;
  content_text text; decision_text text; added uuid; doc public.quote_documents%rowtype; limit_hits integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('view','respond','download') then
    return jsonb_build_object('errorCode','invalid_request');
  end if;
  select * into link from public.quote_client_links where token_hash=p_token_hash;
  if link.id is null then return jsonb_build_object('errorCode','link_unavailable'); end if;
  select * into q from public.quotes where id=link.quote_id and company_id=link.company_id for update;
  select * into link from public.quote_client_links where id=link.id for update;
  if q.id is null or link.id is null or link.revoked_at is not null or link.expires_at<=clock_timestamp() or q.status='draft' then
    return jsonb_build_object('errorCode','link_unavailable');
  end if;
  limit_hits:=case p_action when 'respond' then 6 when 'download' then 12 else 90 end;
  if not public.consume_quote_client_rate('link:'||link.id::text||':'||p_action,limit_hits,60) then return jsonb_build_object('errorCode','rate_limited'); end if;
  if p_action='view' then return public.quote_client_public_view(link.id); end if;
  if p_action='download' then
    select * into doc from public.quote_documents where quote_id=q.id and company_id=q.company_id;
    if doc.id is null then return jsonb_build_object('errorCode','document_unavailable'); end if;
    return jsonb_build_object('storage_path',doc.storage_path,'file_name',doc.file_name,'size_bytes',doc.size_bytes);
  end if;
  if p_kind is null or p_kind not in ('question','accepted','refused') or p_nonce is null or p_confirmed is distinct from true
    or (p_kind='question' and (p_message is null or length(btrim(p_message)) not between 1 and 2000))
    or (p_message is not null and (length(p_message)>2000 or p_message ~ E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]')) then
    return jsonb_build_object('errorCode','invalid_request');
  end if;
  decision_text:=case p_kind when 'accepted' then 'Le client a indiqué accepter le devis.' when 'refused' then 'Le client a indiqué refuser le devis.' else null end;
  content_text:=case when p_kind='question' then btrim(p_message)
    when nullif(btrim(coalesce(p_message,'')),'') is null then decision_text
    else decision_text||E'\n\nCommentaire du client : '||btrim(p_message) end;
  select * into existing from public.quote_client_messages where quote_id=q.id and author='client' and nonce=p_nonce;
  if existing.id is not null then
    if existing.kind<>p_kind or existing.content<>content_text then return jsonb_build_object('errorCode','nonce_conflict'); end if;
    return public.quote_client_public_view(link.id);
  end if;
  if q.expires_at is not null and q.expires_at<=(clock_timestamp() at time zone 'Europe/Paris')::date
    or (p_kind in ('accepted','refused') and q.status<>'sent') then return jsonb_build_object('errorCode','decision_not_allowed'); end if;
  if not public.consume_quote_client_rate('message:'||q.id::text,20,3600) then return jsonb_build_object('errorCode','rate_limited'); end if;
  insert into public.quote_client_messages(company_id,quote_id,link_id,author,kind,content,nonce)
    values(q.company_id,q.id,link.id,'client',p_kind,content_text,p_nonce) returning id into added;
  insert into public.quote_events(company_id,quote_id,event_type,content,portal_message_id)
    values(q.company_id,q.id,'response',content_text,added);
  if p_kind in ('accepted','refused') then update public.quotes set status=p_kind,next_followup_at=null where id=q.id;
  else update public.quotes set next_followup_at=null where id=q.id; end if;
  insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,portal_message_id)
    select q.company_id,m.user_id,'quote_client_message',case p_kind when 'question' then 'Question sur un devis' when 'accepted' then 'Devis accepté par le client' else 'Devis refusé par le client' end,
      'Consultez le dossier '||left(q.reference,100)||' pour lire la réponse du client.',q.id,added
    from public.company_members m join auth.users u on u.id=m.user_id
    where m.company_id=q.company_id and (u.banned_until is null or u.banned_until<=clock_timestamp())
    on conflict(user_id,portal_message_id) where portal_message_id is not null do nothing;
  return public.quote_client_public_view(link.id);
end;
$$;

create function public.guard_communicated_quote_summary() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status<>'draft' and new.status='draft' then
    raise exception 'Un devis déjà communiqué ne peut pas redevenir un brouillon.' using errcode='23514';
  end if;
  if (old.status<>'draft' or old.sent_at is not null) and
    (new.client_id is distinct from old.client_id or new.reference is distinct from old.reference or new.amount_cents is distinct from old.amount_cents) then
    raise exception 'Le client, la référence et le montant ne peuvent plus changer après communication du devis.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_communicated_quote_summary() from public,anon,authenticated,service_role;
create trigger quote_communicated_summary_guard before update on public.quotes
  for each row execute function public.guard_communicated_quote_summary();

create function public.update_quote_if_current(
  p_quote_id uuid,p_expected_updated_at timestamptz,p_client_id uuid,p_reference text,p_amount_cents bigint,
  p_status text,p_sent_at date,p_expires_at date default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; updated public.quotes%rowtype; content_text text;
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'Votre compte ne permet pas cette action.' using errcode='42501';
  end if;
  select * into q from public.quotes where id=p_quote_id for update;
  if not found or not public.is_company_member(q.company_id) then raise exception 'Devis inaccessible.' using errcode='42501'; end if;
  if p_expected_updated_at is null or q.updated_at<>p_expected_updated_at then
    raise exception 'Le dossier a changé depuis son ouverture.' using errcode='40001';
  end if;
  if p_client_id is null or p_reference is null or length(btrim(p_reference)) not between 1 and 120
    or p_amount_cents is null or p_amount_cents<0 or p_amount_cents>9007199254740991
    or p_status is null or p_status not in ('draft','sent','accepted','refused')
    or (p_status='draft' and p_sent_at is not null) or (p_status<>'draft' and p_sent_at is null)
    or (p_expires_at is not null and p_sent_at is not null and p_expires_at<p_sent_at)
    or length(coalesce(p_notes,''))>8000 then
    raise exception 'Vérifiez le client, la référence, le montant et les dates du devis.' using errcode='22023';
  end if;
  perform 1 from public.clients where id=p_client_id and company_id=q.company_id for key share;
  if not found then raise exception 'Client inaccessible.' using errcode='42501'; end if;
  update public.quotes set client_id=p_client_id,reference=btrim(p_reference),amount_cents=p_amount_cents,
    status=p_status,sent_at=p_sent_at,expires_at=p_expires_at,notes=nullif(btrim(coalesce(p_notes,'')),'')
    where id=q.id returning * into updated;
  if q.status<>updated.status then
    content_text:=case updated.status when 'draft' then 'Devis replacé en brouillon.' when 'sent' then 'Devis marqué comme envoyé.'
      when 'accepted' then 'Devis marqué comme accepté.' else 'Devis marqué comme refusé.' end;
    insert into public.quote_events(company_id,quote_id,event_type,content,created_by)
      values(q.company_id,q.id,'status_change',content_text,auth.uid());
  end if;
  return to_jsonb(updated);
end;
$$;
revoke all on function public.update_quote_if_current(uuid,timestamptz,uuid,text,bigint,text,date,date,text) from public,anon,service_role;
grant execute on function public.update_quote_if_current(uuid,timestamptz,uuid,text,bigint,text,date,date,text) to authenticated;

create function public.set_quote_status_if_current(
  p_quote_id uuid,p_expected_updated_at timestamptz,p_status text,p_content text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; updated public.quotes%rowtype; content_text text;
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'Votre compte ne permet pas cette action.' using errcode='42501';
  end if;
  select * into q from public.quotes where id=p_quote_id for update;
  if not found or not public.is_company_member(q.company_id) then raise exception 'Devis inaccessible.' using errcode='42501'; end if;
  if p_expected_updated_at is null or q.updated_at<>p_expected_updated_at then
    raise exception 'Le dossier a changé depuis son ouverture.' using errcode='40001';
  end if;
  if p_status is null or p_status not in ('accepted','refused') or length(coalesce(p_content,''))>8000 then
    raise exception 'Décision invalide.' using errcode='22023';
  end if;
  content_text:=coalesce(nullif(btrim(p_content),''),case p_status when 'accepted' then 'Devis accepté.' else 'Devis refusé.' end);
  update public.quotes set status=p_status,next_followup_at=null where id=q.id returning * into updated;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by)
    values(q.company_id,q.id,'status_change',content_text,auth.uid());
  return to_jsonb(updated);
end;
$$;
revoke all on function public.set_quote_status_if_current(uuid,timestamptz,text,text) from public,anon,service_role;
grant execute on function public.set_quote_status_if_current(uuid,timestamptz,text,text) to authenticated;

create or replace function public.request_quote_initial_send(
  p_quote_id uuid,p_recipient text,p_subject text,p_body text,p_retry_failed boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; d public.quote_documents%rowtype; j public.quote_initial_send_jobs%rowtype;
  contact text; recipient text:=lower(btrim(p_recipient)); subject_text text:=btrim(p_subject); body_text text:=btrim(p_body);
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if not found or not public.is_company_member(q.company_id) then raise exception 'Devis inaccessible.' using errcode='42501'; end if;
  if not public.valid_followup_email(recipient) or subject_text is null or length(subject_text) not between 1 and 160
    or subject_text~E'[\\r\\n]' or body_text is null or length(body_text) not between 1 and 4000 or p_retry_failed is null then
    raise exception 'Vérifiez le destinataire et le message.' using errcode='22023';
  end if;
  select * into j from public.quote_initial_send_jobs where quote_id=q.id and status<>'cancelled' order by created_at desc,id desc limit 1 for update;
  if j.id is not null and j.status='sent' then return to_jsonb(j); end if;
  if q.status<>'draft' or q.sent_at is not null then raise exception 'Ce devis a déjà été envoyé.' using errcode='23514'; end if;
  if j.id is not null and j.status in ('preparing','processing','delivery_unknown') then
    if j.recipient_email<>recipient or j.subject<>subject_text or j.body<>body_text then raise exception 'Un autre envoi de ce devis est déjà en cours.' using errcode='23514'; end if;
    if j.status='processing' and j.lease_until<=clock_timestamp() and j.provider_message_id is null then
      update public.quote_initial_send_jobs set status=case when first_attempt_at is null then 'preparing' else 'delivery_unknown' end,
        ambiguous=first_attempt_at is not null,last_error_code='lease_expired',updated_at=clock_timestamp() where id=j.id returning * into j;
    end if;
    if j.status='delivery_unknown' and p_retry_failed and j.first_attempt_at>clock_timestamp()-interval '23 hours' and j.attempts<5 then
      update public.quote_initial_send_jobs set status='preparing',updated_at=clock_timestamp() where id=j.id returning * into j;
    end if;
    return to_jsonb(j);
  end if;
  if j.id is not null and j.status='failed' then
    if not p_retry_failed then return to_jsonb(j); end if;
    if j.ambiguous or j.provider_message_id is not null then raise exception 'Cet envoi reste à vérifier.' using errcode='23514'; end if;
    update public.quote_initial_send_jobs set status='cancelled',updated_at=clock_timestamp() where id=j.id;
  end if;
  select * into d from public.quote_documents where quote_id=q.id;
  if not found then raise exception 'Ajoutez le PDF du devis avant de l’envoyer.' using errcode='23514'; end if;
  select reply_to into contact from public.company_email_settings where company_id=q.company_id;
  if not public.valid_followup_email(contact) then raise exception 'Ajoutez une adresse de réponse dans les paramètres de l’entreprise.' using errcode='23514'; end if;
  update public.clients set email=recipient where id=q.client_id and company_id=q.company_id and email is distinct from recipient;
  insert into public.quote_initial_send_jobs(company_id,quote_id,document_id,requested_by,recipient_email,reply_to,subject,body,company_name,document_path,file_name,size_bytes)
    values(q.company_id,q.id,d.id,auth.uid(),recipient,contact,subject_text,body_text,(select name from public.companies where id=q.company_id),d.storage_path,d.file_name,d.size_bytes) returning * into j;
  return to_jsonb(j);
end;
$$;

notify pgrst, 'reload schema';
