-- Platform administration is a server-managed capability, never user metadata.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
drop policy if exists platform_admins_select_own on public.platform_admins;
create policy platform_admins_select_own on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to authenticated;
grant select, insert, update, delete on public.platform_admins to service_role;

-- Banned accounts may still hold a previously issued JWT. Check their current
-- Auth state in RLS so suspension takes effect without waiting for JWT expiry.
create or replace function public.current_user_is_active()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and (banned_until is null or banned_until <= now())
  );
$$;
revoke all on function public.current_user_is_active() from public, anon;
grant execute on function public.current_user_is_active() to authenticated, service_role;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_user_is_active() and exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- Existing tenant policies reuse these helpers. Normal memberships still have
-- exactly the same scope; only the explicit platform-admin table extends it.
create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_user_is_active() and (public.is_platform_admin() or exists (
    select 1 from public.company_members m
    where m.company_id = target_company_id and m.user_id = auth.uid()
  ));
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_user_is_active() and (public.is_platform_admin() or exists (
    select 1 from public.company_members m
    where m.company_id = target_company_id and m.user_id = auth.uid()
      and m.role = 'owner'
  ));
$$;

revoke all on function public.is_company_member(uuid) from public, anon;
revoke all on function public.is_company_owner(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated, service_role;
grant execute on function public.is_company_owner(uuid) to authenticated, service_role;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid() and public.current_user_is_active());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid() and public.current_user_is_active())
  with check (user_id = auth.uid() and public.current_user_is_active());

-- Serialize onboarding with ownership transfers. Both paths lock the Auth user
-- before testing memberships, preserving the one-company rule under concurrency.
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = uid for update;
  if not found or not public.current_user_is_active() then
    raise exception 'Account is unavailable' using errcode = '42501';
  end if;
  if company_name is null or length(btrim(company_name)) = 0 then
    raise exception 'Company name is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.company_members where user_id = uid) then
    raise exception 'User already belongs to a company' using errcode = '23514';
  end if;
  insert into public.companies (name) values (btrim(company_name))
    returning id into new_company_id;
  insert into public.company_members (company_id, user_id, role)
    values (new_company_id, uid, 'owner');
  return new_company_id;
end;
$$;
revoke all on function public.create_company_with_owner(text) from public, anon;
grant execute on function public.create_company_with_owner(text) to authenticated;

-- Append-only server journal. User IDs remain after a target account is deleted.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null,
  company_id uuid,
  action text not null check (action in (
    'delete_user', 'suspend_user', 'resume_user', 'transfer_company_owner'
  )),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated, service_role;
grant select, insert on public.admin_audit_log to service_role;

create or replace function public.admin_transfer_company_owner(
  target_company_id uuid,
  new_owner_id uuid
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_banned_until timestamptz;
begin
  if actor is null or not public.is_platform_admin() then
    raise exception 'Platform administrator required' using errcode = '42501';
  end if;
  if target_company_id is null or new_owner_id is null then
    raise exception 'Company and owner are required' using errcode = '22023';
  end if;

  -- The same company lock is taken by account deletion below.
  perform 1 from public.companies where id = target_company_id for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  select banned_until into target_banned_until
    from auth.users where id = new_owner_id for update;
  if not found then
    raise exception 'New owner not found' using errcode = 'P0002';
  end if;
  if target_banned_until is not null and target_banned_until > now() then
    raise exception 'New owner is suspended' using errcode = '23514';
  end if;
  if not exists (select 1 from public.platform_admins where user_id = new_owner_id)
     and exists (
       select 1 from public.company_members
       where user_id = new_owner_id and company_id <> target_company_id
     ) then
    raise exception 'User already belongs to another company' using errcode = '23514';
  end if;

  -- Insert first: never expose a company with no owner, even inside this RPC.
  insert into public.company_members (company_id, user_id, role)
    values (target_company_id, new_owner_id, 'owner')
    on conflict (company_id, user_id) do update set role = 'owner';
  update public.company_members set role = 'member'
    where company_id = target_company_id and role = 'owner'
      and user_id <> new_owner_id;

  insert into public.admin_audit_log (actor_id, target_user_id, company_id, action)
    values (actor, new_owner_id, target_company_id, 'transfer_company_owner');
end;
$$;
revoke all on function public.admin_transfer_company_owner(uuid, uuid)
  from public, anon;
grant execute on function public.admin_transfer_company_owner(uuid, uuid)
  to authenticated, service_role;

-- Enforce owner retention in the database as well as the Edge Function. This
-- protects against concurrent deletes. Suspension remains possible even for a
-- sole owner. Business records stay attached to a company after account removal.
create or replace function public.protect_platform_accounts_and_owners()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  owner_company uuid;
begin
  if exists (select 1 from public.platform_admins where user_id = old.id) then
    raise exception 'Platform administrator accounts are protected'
      using errcode = '23514';
  end if;

  for owner_company in
    select c.id from public.companies c
    join public.company_members m on m.company_id = c.id
    where m.user_id = old.id and m.role = 'owner'
    order by c.id for update of c
  loop
    if not exists (
      select 1 from public.company_members m
      where m.company_id = owner_company and m.role = 'owner'
        and m.user_id <> old.id
    ) then
      raise exception 'Transfer company ownership before deleting its last owner'
        using errcode = '23514';
    end if;
  end loop;
  return old;
end;
$$;
revoke all on function public.protect_platform_accounts_and_owners()
  from public, anon, authenticated, service_role;
drop trigger if exists protect_platform_user_delete on auth.users;
create trigger protect_platform_user_delete before delete on auth.users
  for each row execute function public.protect_platform_accounts_and_owners();

notify pgrst, 'reload schema';
