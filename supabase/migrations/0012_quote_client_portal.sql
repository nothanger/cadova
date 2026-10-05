-- Private, revocable quote sharing. Tokens are 256-bit bearer capabilities;
-- only SHA-256 digests live here, never in browser-readable tables.
create table public.quote_client_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null,
  job_kind text check(job_kind in ('initial','followup')),
  job_id uuid,
  check((job_kind is null)=(job_id is null)),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade,
  unique(job_kind,job_id)
);
create index quote_client_links_quote_idx on public.quote_client_links(quote_id,created_at desc);
alter table public.quote_client_links enable row level security;
revoke all on public.quote_client_links from public,anon,authenticated,service_role;

create table public.quote_client_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null,
  link_id uuid references public.quote_client_links(id) on delete set null,
  author text not null check(author in ('client','company')),
  kind text not null check(kind in ('question','accepted','refused','message')),
  content text not null check(length(btrim(content)) between 1 and 2000),
  nonce uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  check((author='company' and kind='message') or (author='client' and kind in ('question','accepted','refused'))),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade,
  unique(quote_id,author,nonce)
);
create index quote_client_messages_quote_idx on public.quote_client_messages(quote_id,created_at desc,id);
alter table public.quote_client_messages enable row level security;
revoke all on public.quote_client_messages from public,anon,authenticated,service_role;
grant select on public.quote_client_messages to authenticated;
create policy quote_client_messages_select on public.quote_client_messages for select to authenticated using(public.is_company_member(company_id));

-- Persistent counters protect all Edge Function instances. Bucket keys are
-- keyed hashes of network identifiers; no IP addresses or tokens are stored.
create table public.quote_client_rate_buckets (
  bucket_key text primary key check(length(bucket_key) between 1 and 160),
  window_started_at timestamptz not null,
  hits integer not null,
  expires_at timestamptz not null
);
create index quote_client_rate_expiry_idx on public.quote_client_rate_buckets(expires_at);
alter table public.quote_client_rate_buckets enable row level security;
revoke all on public.quote_client_rate_buckets from public,anon,authenticated,service_role;
create function public.consume_quote_client_rate(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare hits integer; instant timestamptz:=clock_timestamp();
begin
  if p_key is null or length(p_key) not between 1 and 160 or p_key !~ '^[a-z0-9:_-]+$'
    or p_limit is null or p_limit not between 1 and 2000 or p_seconds is null or p_seconds not between 10 and 3600 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  insert into public.quote_client_rate_buckets(bucket_key,window_started_at,hits,expires_at)
    values(p_key,instant,1,instant+make_interval(secs=>p_seconds*2))
  on conflict(bucket_key) do update set
    hits=case when quote_client_rate_buckets.window_started_at<=instant-make_interval(secs=>p_seconds) then 1 else quote_client_rate_buckets.hits+1 end,
    window_started_at=case when quote_client_rate_buckets.window_started_at<=instant-make_interval(secs=>p_seconds) then instant else quote_client_rate_buckets.window_started_at end,
    expires_at=instant+make_interval(secs=>p_seconds*2)
  returning quote_client_rate_buckets.hits into hits;
  -- Bounded cleanup avoids a sweep on every request.
  delete from public.quote_client_rate_buckets where bucket_key in
    (select bucket_key from public.quote_client_rate_buckets where expires_at<instant limit 30);
  return hits<=p_limit;
end;
$$;
revoke all on function public.consume_quote_client_rate(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_quote_client_rate(text,integer,integer) to service_role;

alter table public.quote_events add column portal_message_id uuid references public.quote_client_messages(id) on delete set null;
create unique index quote_events_portal_once on public.quote_events(portal_message_id) where portal_message_id is not null;
alter table public.notifications add column portal_message_id uuid references public.quote_client_messages(id) on delete cascade;
create unique index notifications_portal_once on public.notifications(user_id,portal_message_id) where portal_message_id is not null;
-- Daily reminder deduplication must not suppress distinct client messages.
drop index public.notifications_followup_due_once;
create unique index notifications_followup_due_once on public.notifications(user_id,related_quote_id,type,notification_date)
  where related_quote_id is not null and type='quote_followup_due';
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in (
  'quote_followup_due','daily_followup_summary','support_message','admin_message','admin_announcement',
  'quote_followup_sent','quote_followup_failed','quote_sent','quote_send_failed','quote_client_message'
));
drop policy quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events for insert to authenticated with check(
  public.is_company_member(company_id) and (created_by is null or created_by=auth.uid())
  and event_type not in ('followup_auto_sent','followup_auto_failed') and automation_job_id is null
  and initial_send_job_id is null and portal_message_id is null and delivery_status is null
);
drop policy quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events for update to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and portal_message_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'))
  with check(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and portal_message_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'));
drop policy quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events for delete to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and portal_message_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'));

create function public.quote_client_conversation(p_quote_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'author',author,'kind',kind,'content',content,'created_at',created_at) order by created_at,id),'[]'::jsonb)
  from (select * from public.quote_client_messages where quote_id=p_quote_id order by created_at desc,id desc limit 100) m;
$$;
revoke all on function public.quote_client_conversation(uuid) from public,anon,authenticated,service_role;

create function public.inspect_quote_client_link(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; link jsonb;
begin
  select * into q from public.quotes where id=p_quote_id;
  if q.id is null or auth.uid() is null or not public.is_company_member(q.company_id) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  select jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at,'created_at',created_at) into link
    from public.quote_client_links where quote_id=q.id
    order by (revoked_at is null and expires_at>clock_timestamp()) desc,created_at desc,id desc limit 1;
  return jsonb_build_object('link',link,'messages',public.quote_client_conversation(q.id));
end;
$$;
revoke all on function public.inspect_quote_client_link(uuid) from public,anon;
grant execute on function public.inspect_quote_client_link(uuid) to authenticated;

create function public.create_quote_client_link(p_quote_id uuid,p_token_hash text,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; link public.quote_client_links%rowtype;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if q.id is null or auth.uid() is null or not public.is_company_member(q.company_id) then raise exception 'not_allowed' using errcode='42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
    or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '90 days' then raise exception 'invalid_request' using errcode='22023'; end if;
  if q.status='draft' then raise exception 'decision_not_allowed' using errcode='23514'; end if;
  if not public.consume_quote_client_rate('create:'||auth.uid()::text,10,60) then raise exception 'rate_limited' using errcode='54000'; end if;
  -- Rotation affects only manually copied links, not links in delivered emails.
  update public.quote_client_links set revoked_at=clock_timestamp() where quote_id=q.id and job_id is null and revoked_at is null;
  insert into public.quote_client_links(company_id,quote_id,token_hash,expires_at,created_by)
    values(q.company_id,q.id,p_token_hash,p_expires_at,auth.uid()) returning * into link;
  return jsonb_build_object('id',link.id,'expires_at',link.expires_at,'revoked_at',link.revoked_at,'created_at',link.created_at);
end;
$$;
revoke all on function public.create_quote_client_link(uuid,text,timestamptz) from public,anon;
grant execute on function public.create_quote_client_link(uuid,text,timestamptz) to authenticated;

create function public.revoke_quote_client_links(p_quote_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if q.id is null or auth.uid() is null or not public.is_company_member(q.company_id) then raise exception 'not_allowed' using errcode='42501'; end if;
  update public.quote_client_links set revoked_at=clock_timestamp() where quote_id=q.id and revoked_at is null;
end;
$$;
revoke all on function public.revoke_quote_client_links(uuid) from public,anon;
grant execute on function public.revoke_quote_client_links(uuid) to authenticated;

create function public.reply_quote_client_message(p_quote_id uuid,p_message text,p_nonce uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; existing public.quote_client_messages%rowtype; added uuid;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if q.id is null or auth.uid() is null or not public.is_company_member(q.company_id) then raise exception 'not_allowed' using errcode='42501'; end if;
  if p_nonce is null or p_message is null or length(btrim(p_message)) not between 1 and 2000
    or p_message ~ '[[:cntrl:]]' and p_message ~ E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]' then raise exception 'invalid_request' using errcode='22023'; end if;
  select * into existing from public.quote_client_messages where quote_id=q.id and author='company' and nonce=p_nonce;
  if existing.id is not null then
    if existing.content<>btrim(p_message) or existing.created_by is distinct from auth.uid() then raise exception 'nonce_conflict' using errcode='23505'; end if;
    return public.inspect_quote_client_link(q.id);
  end if;
  if not public.consume_quote_client_rate('reply:'||auth.uid()::text,20,60) then raise exception 'rate_limited' using errcode='54000'; end if;
  insert into public.quote_client_messages(company_id,quote_id,author,kind,content,nonce,created_by)
    values(q.company_id,q.id,'company','message',btrim(p_message),p_nonce,auth.uid()) returning id into added;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by,portal_message_id)
    values(q.company_id,q.id,'note',btrim(p_message),auth.uid(),added);
  return public.inspect_quote_client_link(q.id);
end;
$$;
revoke all on function public.reply_quote_client_message(uuid,text,uuid) from public,anon;
grant execute on function public.reply_quote_client_message(uuid,text,uuid) to authenticated;

-- This is a projection, never to_jsonb(quotes/clients): private notes, client email,
-- phone, internal events, user IDs and storage paths must never be exposed.
create function public.quote_client_public_view(p_link_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('quote',jsonb_build_object(
    'reference',q.reference,'company_name',c.name,'client_name',client.name,
    'company_email',case when public.valid_followup_email(settings.reply_to) then settings.reply_to else null end,
    'amount_cents',q.amount_cents,'status',q.status,'expires_at',q.expires_at,
    'document_available',exists(select 1 from public.quote_documents where quote_id=q.id)),
    'link_expires_at',l.expires_at,'can_respond',q.status in ('sent','accepted','refused') and
      (q.expires_at is null or q.expires_at>(clock_timestamp() at time zone 'Europe/Paris')::date),
    'messages',public.quote_client_conversation(q.id))
  from public.quote_client_links l join public.quotes q on q.id=l.quote_id and q.company_id=l.company_id
    join public.companies c on c.id=q.company_id
    left join public.company_email_settings settings on settings.company_id=q.company_id
    join public.clients client on client.id=q.client_id and client.company_id=q.company_id
  where l.id=p_link_id;
$$;
revoke all on function public.quote_client_public_view(uuid) from public,anon,authenticated,service_role;

create function public.use_quote_client_link(
  p_token_hash text,p_action text,p_kind text default null,p_message text default null,p_nonce uuid default null,p_confirmed boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.quote_client_links%rowtype; q public.quotes%rowtype; existing public.quote_client_messages%rowtype;
  content_text text; added uuid; doc public.quote_documents%rowtype; limit_hits integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('view','respond','download') then
    return jsonb_build_object('errorCode','invalid_request');
  end if;
  -- Every path locks quote then link, matching revocation and the send workers.
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
  content_text:=case p_kind when 'accepted' then 'Le client a indiqué accepter le devis.' when 'refused' then 'Le client a indiqué refuser le devis.' else btrim(p_message) end;
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
  -- The existing response trigger atomically pauses/cancels all followups.
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
revoke all on function public.use_quote_client_link(text,text,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.use_quote_client_link(text,text,text,text,uuid,boolean) to service_role;

-- Stable per-job links: the worker derives a pseudorandom 32-byte token using
-- HMAC with its service key. Replays must match the stored digest; revocation
-- cannot accidentally be undone by an automatic retry.
create function public.issue_quote_client_send_link(p_kind text,p_job_id uuid,p_lease_token uuid,p_token_hash text,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare quote_uuid uuid; company_uuid uuid; actor_uuid uuid; status_text text; lease_uuid uuid; lease_time timestamptz;
  link public.quote_client_links%rowtype; reason text;
begin
  if p_kind is null or p_kind not in ('initial','followup') or p_job_id is null or p_lease_token is null
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_request' using errcode='22023'; end if;
  if p_kind='initial' then select quote_id into quote_uuid from public.quote_initial_send_jobs where id=p_job_id;
  else select quote_id into quote_uuid from public.quote_followup_jobs where id=p_job_id; end if;
  perform 1 from public.quotes where id=quote_uuid for update;
  if not found then raise exception 'link_unavailable' using errcode='P0002'; end if;
  if p_kind='initial' then
    select company_id,requested_by,status,lease_token,lease_until into company_uuid,actor_uuid,status_text,lease_uuid,lease_time
      from public.quote_initial_send_jobs where id=p_job_id and quote_id=quote_uuid for update;
    reason:=public.quote_initial_send_block_reason(p_job_id,actor_uuid);
  else
    select company_id,status,lease_token,lease_until into company_uuid,status_text,lease_uuid,lease_time
      from public.quote_followup_jobs where id=p_job_id and quote_id=quote_uuid for update;
    reason:=public.quote_followup_block_reason(p_job_id);
  end if;
  if status_text is distinct from 'processing' or lease_uuid is distinct from p_lease_token or lease_time is null or lease_time<=clock_timestamp()
    or reason is not null or not exists(select 1 from public.quotes where id=quote_uuid and company_id=company_uuid) then
    raise exception 'send_not_allowed' using errcode='23514';
  end if;
  select * into link from public.quote_client_links where job_kind=p_kind and job_id=p_job_id;
  if link.id is not null then
    if link.quote_id<>quote_uuid or link.company_id<>company_uuid or link.token_hash<>p_token_hash or link.revoked_at is not null or link.expires_at<=clock_timestamp() then
      raise exception 'link_unavailable' using errcode='23514';
    end if;
  else
    if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '90 days' then raise exception 'invalid_request' using errcode='22023'; end if;
    insert into public.quote_client_links(company_id,quote_id,token_hash,expires_at,created_by,job_kind,job_id)
      values(company_uuid,quote_uuid,p_token_hash,p_expires_at,actor_uuid,p_kind,p_job_id) returning * into link;
  end if;
  return jsonb_build_object('id',link.id,'quote_id',link.quote_id,'expires_at',link.expires_at,'token_hash',link.token_hash);
end;
$$;
revoke all on function public.issue_quote_client_send_link(text,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_quote_client_send_link(text,uuid,uuid,text,timestamptz) to service_role;
notify pgrst,'reload schema';
