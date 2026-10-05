-- Private quote imports and explicit initial delivery. Nothing in this
-- migration sends email or enables follow-ups on an imported quote.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('quote-documents','quote-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

create table public.quote_documents (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null unique,
  storage_path text not null unique,
  file_name text not null check(length(file_name) between 5 and 180 and file_name !~ E'[\\r\\n/\\\\]' and lower(right(file_name,4))='.pdf'),
  mime_type text not null default 'application/pdf' check(mime_type='application/pdf'),
  size_bytes bigint not null check(size_bytes between 5 and 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade
);
alter table public.quote_documents enable row level security;
revoke all on public.quote_documents from public,anon,authenticated,service_role;
grant select on public.quote_documents to authenticated,service_role;
create policy quote_documents_select on public.quote_documents for select to authenticated
  using(public.is_company_member(company_id));

-- Tombstones remain after physical deletion: an expired staging path can
-- never become live again while a Storage API deletion is in flight.
create table public.quote_document_cleanup (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  status text not null default 'queued' check(status in ('queued','processing','done')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
alter table public.quote_document_cleanup enable row level security;
revoke all on public.quote_document_cleanup from public,anon,authenticated,service_role;

create function public.quote_document_path_company(p_path text) returns uuid
language plpgsql immutable set search_path='' as $$
begin
  if p_path is null or p_path !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.pdf$' then return null; end if;
  return split_part(p_path,'/',1)::uuid;
end;
$$;
revoke all on function public.quote_document_path_company(text) from public,anon;
grant execute on function public.quote_document_path_company(text) to authenticated,service_role;

create function public.can_upload_quote_document(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_company_member(public.quote_document_path_company(p_path))
    and split_part(p_path,'/',2)=auth.uid()::text
    and exists(select 1 from public.companies where id=public.quote_document_path_company(p_path))
    and not exists(select 1 from public.quote_document_cleanup where storage_path=p_path)
    and not exists(select 1 from public.quote_documents where storage_path=p_path);
$$;
create function public.can_read_quote_document(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_company_member(public.quote_document_path_company(p_path)) and (
    split_part(p_path,'/',2)=auth.uid()::text
    or exists(select 1 from public.quote_documents where storage_path=p_path)
  );
$$;
revoke all on function public.can_upload_quote_document(text),public.can_read_quote_document(text) from public,anon;
grant execute on function public.can_upload_quote_document(text),public.can_read_quote_document(text) to authenticated;
create policy quote_document_upload on storage.objects for insert to authenticated
  with check(bucket_id='quote-documents' and public.can_upload_quote_document(name));
create policy quote_document_read on storage.objects for select to authenticated
  using(bucket_id='quote-documents' and public.can_read_quote_document(name));
-- No UPDATE/upsert policy: the attachment behind a frozen payload is immutable.
-- Only the cleanup worker physically removes files. A browser DELETE policy
-- would race an attachment transaction after its RLS predicate was evaluated.
-- Failed/abandoned uploads are reclaimed by the 24-hour staging sweeper.

create table public.quote_initial_send_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  document_id uuid not null references public.quote_documents(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'preparing' check(status in ('preparing','processing','sent','failed','delivery_unknown','cancelled')),
  recipient_email text not null check(public.valid_followup_email(recipient_email)),
  reply_to text not null check(public.valid_followup_email(reply_to)),
  subject text not null check(length(subject) between 1 and 160 and subject !~ E'[\\r\\n]'),
  body text not null check(length(body) between 1 and 4000),
  company_name text not null,
  document_path text not null,
  file_name text not null,
  size_bytes bigint not null,
  mime_type text not null default 'application/pdf',
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  provider_message_id text,
  ambiguous boolean not null default false,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade
);
create unique index quote_initial_send_one_active on public.quote_initial_send_jobs(quote_id)
  where status in ('preparing','processing','sent','delivery_unknown');
create index quote_initial_send_quote_idx on public.quote_initial_send_jobs(quote_id,created_at desc);
alter table public.quote_initial_send_jobs enable row level security;
revoke all on public.quote_initial_send_jobs from public,anon,authenticated,service_role;
grant select on public.quote_initial_send_jobs to authenticated,service_role;
create policy quote_initial_send_select on public.quote_initial_send_jobs for select to authenticated
  using(public.is_company_member(company_id));

-- Large base64 attachment and exact provider request are never browser-readable.
create table public.quote_initial_send_payloads (
  job_id uuid primary key references public.quote_initial_send_jobs(id) on delete cascade,
  payload jsonb not null,
  attachment_sha256 text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.quote_initial_send_payloads enable row level security;
revoke all on public.quote_initial_send_payloads from public,anon,authenticated,service_role;

alter table public.quote_events add column initial_send_job_id uuid references public.quote_initial_send_jobs(id) on delete set null;
create unique index quote_events_initial_send_once on public.quote_events(initial_send_job_id,event_type) where initial_send_job_id is not null;
alter table public.notifications add column initial_send_job_id uuid references public.quote_initial_send_jobs(id) on delete cascade;
create unique index notifications_initial_send_once on public.notifications(user_id,initial_send_job_id,type) where initial_send_job_id is not null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in (
  'quote_followup_due','daily_followup_summary','support_message','admin_message','admin_announcement','quote_followup_sent','quote_followup_failed','quote_sent','quote_send_failed'
));
-- Users may add manual events, but may not forge or erase email acceptance.
drop policy quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events for insert to authenticated with check(
  public.is_company_member(company_id) and (created_by is null or created_by=auth.uid())
  and event_type not in ('followup_auto_sent','followup_auto_failed') and automation_job_id is null and initial_send_job_id is null and delivery_status is null
);
drop policy quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events for update to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'))
  with check(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'));
drop policy quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events for delete to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'));

create function public.guard_quote_initial_send_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  -- PL/pgSQL resolves record fields when preparing an expression. Branches
  -- must be separate because quote/company rows have no quote_id field.
  if tg_table_name='quote_documents' then target:=old.quote_id;
  else target:=old.id;
  end if;
  if exists(select 1 from public.quote_initial_send_jobs j
    where (case when tg_table_name='companies' then j.company_id=target else j.quote_id=target end)
      and j.status in ('preparing','processing','delivery_unknown')) then
    raise exception 'Un envoi est en cours ou reste à vérifier. Terminez-le avant de modifier ou supprimer ce devis.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_quote_initial_send_change() from public,anon,authenticated,service_role;
create trigger quote_initial_guard_quote before update or delete on public.quotes for each row execute function public.guard_quote_initial_send_change();
create trigger quote_initial_guard_company before delete on public.companies for each row execute function public.guard_quote_initial_send_change();
create trigger quote_initial_guard_document before update or delete on public.quote_documents for each row execute function public.guard_quote_initial_send_change();

create function public.enqueue_quote_document_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.quote_document_cleanup(storage_path) values(old.storage_path) on conflict(storage_path) do nothing;
  return old;
end;
$$;
revoke all on function public.enqueue_quote_document_cleanup() from public,anon,authenticated,service_role;
create trigger quote_document_cleanup_after_delete after delete on public.quote_documents for each row execute function public.enqueue_quote_document_cleanup();

create function public.save_imported_quote(
  p_quote_id uuid,p_company_id uuid,p_client_id uuid,p_new_client jsonb,
  p_reference text,p_amount_cents bigint,p_notes text,p_already_sent boolean,
  p_sent_at date,p_expires_at date,p_document jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; existing_quote public.quotes%rowtype; target_client uuid:=p_client_id;
  doc_id uuid; doc_path text; doc_name text; doc_size bigint; object_metadata jsonb;
  today date:=(clock_timestamp() at time zone 'Europe/Paris')::date;
begin
  if not public.is_company_member(p_company_id) then raise exception 'Entreprise inaccessible.' using errcode='42501'; end if;
  if p_quote_id is null or p_reference is null or length(btrim(p_reference)) not between 1 and 120
    or p_amount_cents is null or p_amount_cents<0 or p_amount_cents>9007199254740991
    or length(coalesce(p_notes,''))>8000 or p_already_sent is null
    or (p_already_sent and (p_sent_at is null or p_sent_at>today))
    or (not p_already_sent and p_sent_at is not null)
    or (p_expires_at is not null and p_already_sent and p_expires_at<p_sent_at) then
    raise exception 'Vérifiez la référence, le montant et les dates du devis.' using errcode='22023';
  end if;
  -- Also serialize the first insert, before a quote row exists.
  perform pg_advisory_xact_lock(hashtextextended('quote-import:'||p_quote_id::text,0));
  select * into existing_quote from public.quotes where id=p_quote_id for update;
  if found then
    if existing_quote.company_id<>p_company_id then raise exception 'Devis inaccessible.' using errcode='42501'; end if;
    -- Retry after a lost response returns the committed import without creating
    -- another client/event. Changing an existing quote uses its dedicated editor.
    if existing_quote.reference=btrim(p_reference) and existing_quote.amount_cents=p_amount_cents
      and existing_quote.notes is not distinct from nullif(btrim(p_notes),'')
      and existing_quote.sent_at is not distinct from p_sent_at
      and existing_quote.expires_at is not distinct from p_expires_at
      and (p_client_id is null or existing_quote.client_id=p_client_id)
      and ((p_document is null and not exists(select 1 from public.quote_documents where quote_id=p_quote_id))
        or exists(select 1 from public.quote_documents where quote_id=p_quote_id and id::text=p_document->>'id' and storage_path=p_document->>'storage_path')) then
      return to_jsonb(existing_quote);
    end if;
    raise exception 'Ce devis existe déjà. Ouvrez-le pour le modifier.' using errcode='23514';
  end if;
  if (p_client_id is null)=(p_new_client is null) then raise exception 'Sélectionnez un client ou créez-en un.' using errcode='22023'; end if;
  if p_client_id is not null then
    perform 1 from public.clients where id=p_client_id and company_id=p_company_id for key share;
    if not found then raise exception 'Client inaccessible.' using errcode='42501'; end if;
  else
    if jsonb_typeof(p_new_client)<>'object' or length(btrim(coalesce(p_new_client->>'name',''))) not between 1 and 200
      or length(coalesce(p_new_client->>'phone',''))>80 or length(coalesce(p_new_client->>'notes',''))>8000
      or (nullif(btrim(p_new_client->>'email'),'') is not null and not public.valid_followup_email(lower(btrim(p_new_client->>'email')))) then
      raise exception 'Vérifiez les coordonnées du client.' using errcode='22023';
    end if;
    insert into public.clients(company_id,name,email,phone,notes)
      values(p_company_id,btrim(p_new_client->>'name'),nullif(lower(btrim(p_new_client->>'email')),''),nullif(btrim(p_new_client->>'phone'),''),nullif(btrim(p_new_client->>'notes'),'')) returning id into target_client;
  end if;
  if p_document is not null then
    if jsonb_typeof(p_document)<>'object' then raise exception 'Document invalide.' using errcode='22023'; end if;
    begin
      doc_id:=(p_document->>'id')::uuid; doc_size:=(p_document->>'size_bytes')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Document invalide.' using errcode='22023'; end;
    doc_path:=p_document->>'storage_path'; doc_name:=p_document->>'file_name';
    if doc_id is null or doc_size is null or doc_size not between 5 and 10485760 or doc_name is null
      or length(doc_name) not between 5 and 180 or doc_name ~ E'[\\r\\n/\\\\]' or lower(right(doc_name,4))<>'.pdf'
      or doc_path is distinct from p_company_id::text||'/'||auth.uid()::text||'/'||doc_id::text||'.pdf' then
      raise exception 'Document invalide.' using errcode='22023';
    end if;
    -- Serialize binding with the orphan sweeper. A queued deletion is final.
    select metadata into object_metadata from storage.objects where bucket_id='quote-documents' and name=doc_path for update;
    if not found or object_metadata->>'mimetype' is distinct from 'application/pdf'
      or coalesce(object_metadata->>'size','') !~ '^[0-9]{1,10}$' then
      raise exception 'Le PDF doit être téléversé avant de sauvegarder le devis.' using errcode='23514';
    end if;
    if (object_metadata->>'size')::bigint<>doc_size or exists(select 1 from public.quote_document_cleanup where storage_path=doc_path) then
      raise exception 'Ce document a expiré. Importez-le à nouveau.' using errcode='23514';
    end if;
  end if;
  insert into public.quotes(id,company_id,client_id,reference,amount_cents,notes,status,sent_at,expires_at)
    values(p_quote_id,p_company_id,target_client,btrim(p_reference),p_amount_cents,nullif(btrim(p_notes),''),case when p_already_sent then 'sent' else 'draft' end,p_sent_at,p_expires_at)
    returning * into q;
  if p_document is not null then
    delete from public.quote_documents where quote_id=q.id and id<>doc_id;
    insert into public.quote_documents(id,company_id,quote_id,storage_path,file_name,size_bytes,uploaded_by)
      values(doc_id,p_company_id,q.id,doc_path,doc_name,doc_size,auth.uid());
  end if;
  if p_already_sent then
    insert into public.quote_events(company_id,quote_id,event_type,content,occurred_at,created_by)
      values(p_company_id,q.id,'sent','Devis déjà envoyé, ajouté au suivi.',(p_sent_at+time '12:00') at time zone 'Europe/Paris',auth.uid());
  end if;
  return to_jsonb(q);
end;
$$;
revoke all on function public.save_imported_quote(uuid,uuid,uuid,jsonb,text,bigint,text,boolean,date,date,jsonb) from public,anon;
grant execute on function public.save_imported_quote(uuid,uuid,uuid,jsonb,text,bigint,text,boolean,date,date,jsonb) to authenticated;

-- Attach/replace an existing draft's PDF without resaving business fields.
create function public.attach_quote_document(p_quote_id uuid,p_document jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; d public.quote_documents%rowtype;
  doc_id uuid; doc_path text; doc_name text; doc_size bigint; object_metadata jsonb;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if not found or not public.is_company_member(q.company_id) then raise exception 'Devis inaccessible.' using errcode='42501'; end if;
  if q.status<>'draft' or q.sent_at is not null then raise exception 'Le document d’un devis envoyé ne peut plus être remplacé.' using errcode='23514'; end if;
  if exists(select 1 from public.quote_initial_send_jobs where quote_id=q.id and status in ('preparing','processing','delivery_unknown','sent')) then
    raise exception 'Un envoi est en cours ou reste à vérifier.' using errcode='23514';
  end if;
  if p_document is null or jsonb_typeof(p_document)<>'object' then raise exception 'Document invalide.' using errcode='22023'; end if;
  begin
    doc_id:=(p_document->>'id')::uuid; doc_size:=(p_document->>'size_bytes')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Document invalide.' using errcode='22023'; end;
  doc_path:=p_document->>'storage_path'; doc_name:=p_document->>'file_name';
  if doc_id is null or doc_size is null or doc_size not between 5 and 10485760 or doc_name is null
    or length(doc_name) not between 5 and 180 or doc_name ~ E'[\\r\\n/\\\\]' or lower(right(doc_name,4))<>'.pdf'
    or doc_path is distinct from q.company_id::text||'/'||auth.uid()::text||'/'||doc_id::text||'.pdf' then
    raise exception 'Document invalide.' using errcode='22023';
  end if;
  select * into d from public.quote_documents where quote_id=q.id;
  if d.id=doc_id and d.storage_path=doc_path and d.size_bytes=doc_size and d.file_name=doc_name then return to_jsonb(d); end if;
  select metadata into object_metadata from storage.objects where bucket_id='quote-documents' and name=doc_path for update;
  if not found or object_metadata->>'mimetype' is distinct from 'application/pdf'
    or coalesce(object_metadata->>'size','') !~ '^[0-9]{1,10}$' then
    raise exception 'Le PDF doit être téléversé avant de sauvegarder le devis.' using errcode='23514';
  end if;
  if (object_metadata->>'size')::bigint<>doc_size or exists(select 1 from public.quote_document_cleanup where storage_path=doc_path) then
    raise exception 'Ce document a expiré. Importez-le à nouveau.' using errcode='23514';
  end if;
  delete from public.quote_documents where quote_id=q.id;
  insert into public.quote_documents(id,company_id,quote_id,storage_path,file_name,size_bytes,uploaded_by)
    values(doc_id,q.company_id,q.id,doc_path,doc_name,doc_size,auth.uid()) returning * into d;
  return to_jsonb(d);
end;
$$;
revoke all on function public.attach_quote_document(uuid,jsonb) from public,anon;
grant execute on function public.attach_quote_document(uuid,jsonb) to authenticated;

create function public.request_quote_initial_send(
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
  insert into public.quote_initial_send_jobs(company_id,quote_id,document_id,requested_by,recipient_email,reply_to,subject,body,company_name,document_path,file_name,size_bytes)
    values(q.company_id,q.id,d.id,auth.uid(),recipient,contact,subject_text,body_text,(select name from public.companies where id=q.company_id),d.storage_path,d.file_name,d.size_bytes) returning * into j;
  return to_jsonb(j);
end;
$$;
revoke all on function public.request_quote_initial_send(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.request_quote_initial_send(uuid,text,text,text,boolean) to authenticated;

create function public.cancel_quote_initial_send(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid; j public.quote_initial_send_jobs%rowtype;
begin
  select quote_id into target from public.quote_initial_send_jobs where id=p_job_id;
  perform 1 from public.quotes where id=target for update;
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if not found or not public.is_company_member(j.company_id) then raise exception 'Envoi inaccessible.' using errcode='42501'; end if;
  if j.provider_message_id is not null or j.ambiguous or not(j.status='failed' or (j.status='preparing' and j.first_attempt_at is null)) then
    raise exception 'Un envoi commencé doit être vérifié avant toute modification.' using errcode='23514';
  end if;
  update public.quote_initial_send_jobs set status='cancelled',updated_at=clock_timestamp() where id=j.id;
end;
$$;
revoke all on function public.cancel_quote_initial_send(uuid) from public,anon;
grant execute on function public.cancel_quote_initial_send(uuid) to authenticated;

create function public.lock_quote_initial_send(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select quote_id into target from public.quote_initial_send_jobs where id=p_job_id;
  perform 1 from public.quotes where id=target for update;
  if not found then raise exception 'Envoi introuvable.' using errcode='P0002'; end if;
end;
$$;
create function public.quote_initial_send_block_reason(p_job_id uuid,p_actor_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype; q public.quotes%rowtype;
begin
  select * into j from public.quote_initial_send_jobs where id=p_job_id;
  select * into q from public.quotes where id=j.quote_id;
  if j.id is null or q.id is null then return 'quote_missing'; end if;
  if j.requested_by is distinct from p_actor_id or not exists(select 1 from auth.users u where u.id=p_actor_id
    and (u.banned_until is null or u.banned_until<=clock_timestamp())
    and (exists(select 1 from public.company_members where company_id=j.company_id and user_id=u.id)
      or exists(select 1 from public.platform_admins where user_id=u.id))) then return 'actor_unavailable'; end if;
  if q.status<>'draft' or q.sent_at is not null then return 'already_sent'; end if;
  if not exists(select 1 from public.quote_documents where id=j.document_id and quote_id=j.quote_id and storage_path=j.document_path and size_bytes=j.size_bytes) then return 'document_changed'; end if;
  if not exists(select 1 from public.company_email_settings where company_id=j.company_id and reply_to=j.reply_to) then return 'contact_changed'; end if;
  return null;
end;
$$;
revoke all on function public.lock_quote_initial_send(uuid),public.quote_initial_send_block_reason(uuid,uuid) from public,anon,authenticated,service_role;

create function public.claim_quote_initial_send(p_job_id uuid,p_actor_id uuid,p_lease_seconds integer default 300) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype; reason text; frozen jsonb;
begin
  if p_lease_seconds is null or p_lease_seconds not between 120 and 900 then raise exception 'Réservation invalide.' using errcode='22023'; end if;
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if j.requested_by is distinct from p_actor_id then return jsonb_build_object('allowed',false,'reason','actor_unavailable'); end if;
  if j.status='sent' then return to_jsonb(j)||jsonb_build_object('allowed',false,'reason','already_sent'); end if;
  if j.status='processing' and j.lease_until>clock_timestamp() then return to_jsonb(j)||jsonb_build_object('allowed',false,'reason','in_progress'); end if;
  if j.status='processing' and j.provider_message_id is null and j.first_attempt_at is not null then
    update public.quote_initial_send_jobs set status='delivery_unknown',ambiguous=true,last_error_code='lease_expired',updated_at=clock_timestamp() where id=j.id returning * into j;
  end if;
  if j.status not in ('preparing','processing') then return to_jsonb(j)||jsonb_build_object('allowed',false,'reason',j.status); end if;
  -- Once acceptance is recorded, completion must remain possible even if a
  -- member was removed afterwards. No further provider request will be made.
  if j.provider_message_id is null then
    reason:=public.quote_initial_send_block_reason(j.id,p_actor_id);
    if reason is null and (j.attempts>=5 or (j.first_attempt_at is not null and j.first_attempt_at<=clock_timestamp()-interval '23 hours')) then reason:='idempotency_window_expired'; end if;
    if reason is not null then
      update public.quote_initial_send_jobs set status=case when ambiguous or first_attempt_at is not null then 'delivery_unknown' else 'failed' end,
        last_error_code=reason,updated_at=clock_timestamp() where id=j.id returning * into j;
      return to_jsonb(j)||jsonb_build_object('allowed',false,'reason',reason);
    end if;
  end if;
  update public.quote_initial_send_jobs set status='processing',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
    attempts=attempts+case when provider_message_id is null then 1 else 0 end,updated_at=clock_timestamp() where id=j.id returning * into j;
  select payload into frozen from public.quote_initial_send_payloads where job_id=j.id;
  return to_jsonb(j)||jsonb_build_object('allowed',true,'provider_payload',frozen,'sender',frozen->>'from');
end;
$$;
revoke all on function public.claim_quote_initial_send(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_quote_initial_send(uuid,uuid,integer) to service_role;

create function public.persist_quote_initial_payload(p_job_id uuid,p_lease_token uuid,p_payload jsonb,p_attachment_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype; frozen jsonb; attachment jsonb; raw_bytes bytea; reason text;
begin
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  reason:=public.quote_initial_send_block_reason(j.id,j.requested_by);
  if reason is not null then raise exception 'Cet envoi n’est plus autorisé.' using errcode='23514'; end if;
  select payload into frozen from public.quote_initial_send_payloads where job_id=j.id;
  if frozen is null then
    if p_payload is null or jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>7
      or p_payload->>'to' is distinct from j.recipient_email or p_payload->>'reply_to' is distinct from j.reply_to
      or p_payload->>'subject' is distinct from j.subject or p_payload->>'text' is distinct from j.body
      or coalesce(length(p_payload->>'from'),0) not between 1 and 320 or p_payload->>'from' ~ E'[\\r\\n]'
      or jsonb_typeof(p_payload->'html') is distinct from 'string' or length(p_payload->>'html')>40000
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

create function public.record_quote_initial_acceptance(p_job_id uuid,p_lease_token uuid,p_provider_message_id text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype;
begin
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if j.lease_token is distinct from p_lease_token or j.status not in ('processing','sent') then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 200 or p_provider_message_id ~ E'[\\r\\n]'
    or j.first_attempt_at is null or not exists(select 1 from public.quote_initial_send_payloads where job_id=j.id)
    or (j.provider_message_id is not null and j.provider_message_id<>p_provider_message_id) then raise exception 'Confirmation du service email invalide.' using errcode='22023'; end if;
  update public.quote_initial_send_jobs set provider_message_id=p_provider_message_id,ambiguous=false,updated_at=clock_timestamp() where id=j.id;
end;
$$;
create function public.complete_quote_initial_send(p_job_id uuid,p_lease_token uuid,p_provider_message_id text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype;
begin
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if j.lease_token is distinct from p_lease_token then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if j.status='sent' and j.provider_message_id=p_provider_message_id then return; end if;
  if j.status<>'processing' then raise exception 'Cet envoi n’est pas réservé.' using errcode='23514'; end if;
  perform public.record_quote_initial_acceptance(j.id,p_lease_token,p_provider_message_id);
  -- Release the edit guard only in the same transaction as business completion.
  update public.quote_initial_send_jobs set status='sent',sent_at=clock_timestamp(),lease_until=null,last_error_code=null,updated_at=clock_timestamp() where id=j.id;
  update public.quotes set status='sent',sent_at=(clock_timestamp() at time zone 'Europe/Paris')::date where id=j.quote_id;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by,initial_send_job_id,delivery_status)
    values(j.company_id,j.quote_id,'sent',j.body,j.requested_by,j.id,'sent') on conflict(initial_send_job_id,event_type) where initial_send_job_id is not null do nothing;
  if j.requested_by is not null then
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,initial_send_job_id)
      values(j.company_id,j.requested_by,'quote_sent','Devis envoyé','Le service email a accepté le devis et sa pièce jointe.',j.quote_id,j.id)
      on conflict(user_id,initial_send_job_id,type) where initial_send_job_id is not null do nothing;
  end if;
end;
$$;
create function public.fail_quote_initial_send(p_job_id uuid,p_lease_token uuid,p_error_code text,p_ambiguous boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_initial_send_jobs%rowtype; uncertain boolean;
begin
  perform public.lock_quote_initial_send(p_job_id);
  select * into j from public.quote_initial_send_jobs where id=p_job_id for update;
  if j.lease_token is distinct from p_lease_token or j.status<>'processing' then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' or p_ambiguous is null then raise exception 'Code d’échec invalide.' using errcode='22023'; end if;
  if j.provider_message_id is not null then
    -- Recovery completes the accepted job without another Resend request.
    update public.quote_initial_send_jobs set lease_until=clock_timestamp(),last_error_code=p_error_code,updated_at=clock_timestamp() where id=j.id;
    return;
  end if;
  uncertain:=j.ambiguous or p_ambiguous;
  update public.quote_initial_send_jobs set status=case when uncertain then 'delivery_unknown' else 'failed' end,
    ambiguous=uncertain,lease_until=null,last_error_code=p_error_code,updated_at=clock_timestamp() where id=j.id;
  if j.requested_by is not null then
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,initial_send_job_id)
      values(j.company_id,j.requested_by,'quote_send_failed',case when uncertain then 'Envoi du devis à vérifier' else 'Devis non envoyé' end,
        case when uncertain then 'Le service email n’a pas confirmé le résultat. Consultez le devis avant de réessayer.' else 'Ouvrez le devis pour corriger le problème et réessayer.' end,j.quote_id,j.id)
      on conflict(user_id,initial_send_job_id,type) where initial_send_job_id is not null do nothing;
  end if;
end;
$$;
revoke all on function public.record_quote_initial_acceptance(uuid,uuid,text),public.complete_quote_initial_send(uuid,uuid,text),public.fail_quote_initial_send(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.record_quote_initial_acceptance(uuid,uuid,text),public.complete_quote_initial_send(uuid,uuid,text),public.fail_quote_initial_send(uuid,uuid,text,boolean) to service_role;

create function public.claim_quote_document_cleanup(p_batch_size integer default 20,p_lease_seconds integer default 300)
returns table(id uuid,storage_path text,lease_token uuid)
language plpgsql security definer set search_path='' as $$
declare candidate record; cleanup public.quote_document_cleanup%rowtype; token uuid;
begin
  if p_batch_size is null or p_batch_size not between 1 and 50 or p_lease_seconds is null or p_lease_seconds not between 120 and 900 then raise exception 'Nettoyage invalide.' using errcode='22023'; end if;
  for candidate in select o.name from storage.objects o where o.bucket_id='quote-documents' and o.created_at<clock_timestamp()-interval '24 hours'
    and not exists(select 1 from public.quote_documents d where d.storage_path=o.name)
    and not exists(select 1 from public.quote_document_cleanup c where c.storage_path=o.name)
    order by o.created_at limit 100 for update of o skip locked loop
    -- save_imported_quote holds the same object row lock before binding.
    if not exists(select 1 from public.quote_documents d where d.storage_path=candidate.name) then
      insert into public.quote_document_cleanup(storage_path) values(candidate.name)
        on conflict on constraint quote_document_cleanup_storage_path_key do nothing;
    end if;
  end loop;
  for cleanup in select c.* from public.quote_document_cleanup c where
    (c.status='queued' and c.next_attempt_at<=clock_timestamp()) or (c.status='processing' and c.lease_until<=clock_timestamp())
    order by c.created_at limit p_batch_size for update skip locked loop
    if exists(select 1 from public.quote_documents d where d.storage_path=cleanup.storage_path) then continue; end if;
    token:=gen_random_uuid();
    update public.quote_document_cleanup c set status='processing',lease_token=token,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=c.attempts+1 where c.id=cleanup.id;
    id:=cleanup.id;storage_path:=cleanup.storage_path;lease_token:=token;return next;
  end loop;
end;
$$;
create function public.complete_quote_document_cleanup(p_id uuid,p_lease_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.quote_document_cleanup set status='done',lease_until=null,completed_at=clock_timestamp()
    where id=p_id and status='processing' and lease_token=p_lease_token
      and not exists(select 1 from public.quote_documents d where d.storage_path=quote_document_cleanup.storage_path);
  if not found then raise exception 'Réservation expirée.' using errcode='23514'; end if;
end;
$$;
create function public.fail_quote_document_cleanup(p_id uuid,p_lease_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.quote_document_cleanup set status='queued',lease_until=null,next_attempt_at=clock_timestamp()+interval '30 minutes'
    where id=p_id and status='processing' and lease_token=p_lease_token;
  if not found then raise exception 'Réservation expirée.' using errcode='23514'; end if;
end;
$$;
revoke all on function public.claim_quote_document_cleanup(integer,integer),public.complete_quote_document_cleanup(uuid,uuid),public.fail_quote_document_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_quote_document_cleanup(integer,integer),public.complete_quote_document_cleanup(uuid,uuid),public.fail_quote_document_cleanup(uuid,uuid) to service_role;

create table public.quote_document_cleanup_nonces(nonce uuid primary key,issued_at bigint not null);
alter table public.quote_document_cleanup_nonces enable row level security;
revoke all on public.quote_document_cleanup_nonces from public,anon,authenticated,service_role;
create function public.consume_quote_document_cleanup_nonce(p_nonce uuid,p_issued_at bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_epoch bigint:=floor(extract(epoch from clock_timestamp()))::bigint; inserted_rows integer;
begin
  if p_nonce is null or p_issued_at is null or p_issued_at<current_epoch-300 or p_issued_at>current_epoch+30 then return false; end if;
  delete from public.quote_document_cleanup_nonces where issued_at<current_epoch-600;
  insert into public.quote_document_cleanup_nonces(nonce,issued_at) values(p_nonce,p_issued_at) on conflict(nonce) do nothing;
  get diagnostics inserted_rows=row_count;return inserted_rows=1;
end;
$$;
revoke all on function public.consume_quote_document_cleanup_nonce(uuid,bigint) from public,anon,authenticated;
grant execute on function public.consume_quote_document_cleanup_nonce(uuid,bigint) to service_role;
notify pgrst,'reload schema';
