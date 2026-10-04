-- Private support conversations and administrator announcements. All message
-- writes go through transaction-safe RPCs; sender roles come from the database.
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'admin')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp(),
  request_id uuid not null,
  unique (sender_id, request_id),
  unique (thread_id, id)
);
create index if not exists support_threads_updated_idx
  on public.support_threads (updated_at desc, id desc);
create index if not exists support_messages_thread_idx
  on public.support_messages (thread_id, created_at desc, id desc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists support_threads_select on public.support_threads;
create policy support_threads_select on public.support_threads for select to authenticated
  using (public.current_user_is_active() and (user_id = auth.uid() or public.is_platform_admin()));
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
  using (public.current_user_is_active() and exists (
    select 1 from public.support_threads t where t.id = thread_id
      and (t.user_id = auth.uid() or public.is_platform_admin())
  ));
revoke all on public.support_threads, public.support_messages from public, anon, authenticated;
grant select on public.support_threads, public.support_messages to authenticated;
grant select, insert on public.support_threads, public.support_messages to service_role;

alter table public.notifications alter column company_id drop not null;
alter table public.notifications
  add column if not exists support_thread_id uuid references public.support_threads(id) on delete cascade,
  add column if not exists support_message_id uuid;
alter table public.notifications drop constraint if exists notifications_support_message_fkey;
alter table public.notifications add constraint notifications_support_message_fkey
  foreign key (support_thread_id, support_message_id)
  references public.support_messages(thread_id, id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'quote_followup_due', 'daily_followup_summary',
  'support_message', 'admin_message', 'admin_announcement'
));
alter table public.notifications drop constraint if exists notifications_business_company_check;
alter table public.notifications add constraint notifications_business_company_check
  check (type not in ('quote_followup_due', 'daily_followup_summary') or company_id is not null);
create index if not exists notifications_support_unread_idx
  on public.notifications (user_id, support_thread_id) where read_at is null and support_thread_id is not null;

-- The former index covered every null quote reference. Restrict it to the
-- daily business summary so support messages are never mistaken for duplicates.
drop index if exists public.notifications_daily_summary_once;
create unique index notifications_daily_summary_once
  on public.notifications (user_id, type, notification_date)
  where related_quote_id is null and type = 'daily_followup_summary';

-- Clients can only acknowledge their own notifications, never rewrite content,
-- recipients, links or types. Existing select/update RLS still requires activity.
revoke insert, update, delete on public.notifications from public, anon, authenticated;
grant select, update(read_at) on public.notifications to authenticated;
grant select, insert on public.notifications to service_role;

create table if not exists public.admin_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  request_id uuid not null,
  recipient_id uuid,
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 4000),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_at timestamptz not null default now(),
  unique (actor_id, request_id)
);
alter table public.admin_notification_dispatches enable row level security;
revoke all on public.admin_notification_dispatches from public, anon, authenticated, service_role;
grant select, insert on public.admin_notification_dispatches to service_role;

create or replace function public.send_support_message(
  p_body text,
  p_thread_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  admin_sender boolean;
  content text := btrim(p_body);
  thread_owner uuid;
  target_thread uuid;
  new_message uuid;
  previous public.support_messages%rowtype;
begin
  if actor is null or not public.current_user_is_active() then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = '42501';
  end if;
  if content is null or length(content) not between 1 and 4000 or p_request_id is null then
    raise exception 'Le message doit contenir entre 1 et 4 000 caractères.' using errcode = '22023';
  end if;
  admin_sender := public.is_platform_admin();
  -- Serialize retries before creating a thread or generating notifications.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support:' || actor::text || ':' || p_request_id::text, 0));
  select * into previous from public.support_messages
    where sender_id = actor and request_id = p_request_id;
  if found then
    if previous.body <> content
      or (p_thread_id is not null and previous.thread_id <> p_thread_id)
      or (p_thread_id is null and not exists (select 1 from public.support_threads where id = previous.thread_id and user_id = actor)) then
      raise exception 'Cette demande a déjà été utilisée pour un autre message.' using errcode = '22023';
    end if;
    return previous.thread_id;
  end if;

  if p_thread_id is null then
    insert into public.support_threads (user_id) values (actor)
      on conflict (user_id) do update set user_id = excluded.user_id
      returning id, user_id into target_thread, thread_owner;
  else
    select id, user_id into target_thread, thread_owner from public.support_threads
      where id = p_thread_id for update;
    if not found then
      raise exception 'Cette conversation n’existe plus.' using errcode = 'P0002';
    end if;
    if thread_owner <> actor and not admin_sender then
      raise exception 'Vous ne pouvez pas écrire dans cette conversation.' using errcode = '42501';
    end if;
  end if;
  if not exists (select 1 from auth.users where id = thread_owner and (banned_until is null or banned_until <= now())) then
    raise exception 'Le destinataire de cette conversation est indisponible.' using errcode = 'P0002';
  end if;

  insert into public.support_messages (thread_id, sender_id, sender_role, body, request_id)
    values (target_thread, actor, case when admin_sender then 'admin' else 'user' end, content, p_request_id)
    returning id into new_message;
  update public.support_threads set updated_at = clock_timestamp() where id = target_thread;

  if admin_sender then
    insert into public.notifications (user_id, type, title, message, support_thread_id, support_message_id)
      values (thread_owner, 'admin_message', 'Réponse de l’équipe Cadova', content, target_thread, new_message);
  else
    insert into public.notifications (user_id, type, title, message, support_thread_id, support_message_id)
      select a.user_id, 'support_message', 'Message au support', content, target_thread, new_message
      from public.platform_admins a join auth.users u on u.id = a.user_id
      where u.banned_until is null or u.banned_until <= now();
  end if;
  return target_thread;
end;
$$;
revoke all on function public.send_support_message(text, uuid, uuid) from public, anon;
grant execute on function public.send_support_message(text, uuid, uuid) to authenticated;

create or replace function public.list_support_threads(p_page integer default 1, p_page_size integer default 25)
returns table (
  id uuid, user_id uuid, user_email text, updated_at timestamptz,
  last_body text, last_sender_role text, unread_count bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page > 100000 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'La pagination est invalide.' using errcode = '22023';
  end if;
  return query
    select t.id, t.user_id, u.email::text, t.updated_at, latest.body, latest.sender_role,
      (select count(*) from public.notifications n where n.user_id = auth.uid()
        and n.support_thread_id = t.id and n.read_at is null)
    from public.support_threads t join auth.users u on u.id = t.user_id
    left join lateral (
      select m.body, m.sender_role from public.support_messages m
      where m.thread_id = t.id order by m.created_at desc, m.id desc limit 1
    ) latest on true
    where t.user_id = auth.uid() or public.is_platform_admin()
    order by t.updated_at desc, t.id desc
    limit p_page_size + 1 offset (p_page - 1) * p_page_size;
end;
$$;
revoke all on function public.list_support_threads(integer, integer) from public, anon;
grant execute on function public.list_support_threads(integer, integer) to authenticated;

create or replace function public.mark_support_thread_read(p_thread_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = '42501';
  end if;
  if p_thread_id is null then
    raise exception 'La conversation est requise.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.support_threads where id = p_thread_id
    and (user_id = auth.uid() or public.is_platform_admin())) then
    raise exception 'Cette conversation est inaccessible.' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
    where user_id = auth.uid() and support_thread_id = p_thread_id and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.mark_support_thread_read(uuid) from public, anon;
grant execute on function public.mark_support_thread_read(uuid) to authenticated;

create or replace function public.send_admin_notification(
  p_title text,
  p_body text,
  p_recipient_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  title_text text := btrim(p_title);
  body_text text := btrim(p_body);
  previous public.admin_notification_dispatches%rowtype;
  sent_count integer;
begin
  if actor is null or not public.is_platform_admin() then
    raise exception 'Cet envoi est réservé à l’administrateur de Cadova.' using errcode = '42501';
  end if;
  if title_text is null or length(title_text) not between 1 and 120
    or body_text is null or length(body_text) not between 1 and 4000 or p_request_id is null then
    raise exception 'Le titre doit contenir entre 1 et 120 caractères et le message entre 1 et 4 000 caractères.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('announcement:' || actor::text || ':' || p_request_id::text, 0));
  select * into previous from public.admin_notification_dispatches
    where actor_id = actor and request_id = p_request_id;
  if found then
    if previous.title <> title_text or previous.body <> body_text
      or previous.recipient_id is distinct from p_recipient_id then
      raise exception 'Cette demande a déjà été utilisée pour un autre envoi.' using errcode = '22023';
    end if;
    return jsonb_build_object('recipient_count', previous.recipient_count);
  end if;
  if p_recipient_id is not null and not exists (
    select 1 from auth.users where id = p_recipient_id and (banned_until is null or banned_until <= now())
  ) then
    raise exception 'Ce destinataire est indisponible.' using errcode = 'P0002';
  end if;

  insert into public.notifications (user_id, type, title, message)
    select u.id, case when p_recipient_id is null then 'admin_announcement' else 'admin_message' end, title_text, body_text
    from auth.users u where (p_recipient_id is null or u.id = p_recipient_id)
      and (u.banned_until is null or u.banned_until <= now());
  get diagnostics sent_count = row_count;
  insert into public.admin_notification_dispatches (actor_id, request_id, recipient_id, title, body, recipient_count)
    values (actor, p_request_id, p_recipient_id, title_text, body_text, sent_count);
  return jsonb_build_object('recipient_count', sent_count);
end;
$$;
revoke all on function public.send_admin_notification(text, text, uuid, uuid) from public, anon;
grant execute on function public.send_admin_notification(text, text, uuid, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
notify pgrst, 'reload schema';
