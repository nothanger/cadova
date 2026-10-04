-- Company administration uses narrow RPCs; clients receive no direct DELETE
-- privilege or write policy on companies/company_members.
alter table public.admin_audit_log alter column target_user_id drop not null;
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check
  check (action in (
    'delete_user', 'suspend_user', 'resume_user', 'transfer_company_owner',
    'create_company', 'delete_company'
  ));
alter table public.admin_audit_log drop constraint if exists admin_audit_log_target_check;
alter table public.admin_audit_log add constraint admin_audit_log_target_check check (
  (action = 'delete_company' and company_id is not null and target_user_id is null)
  or (action in ('create_company', 'transfer_company_owner') and company_id is not null and target_user_id is not null)
  or (action in ('delete_user', 'suspend_user', 'resume_user') and target_user_id is not null)
);

create or replace function public.admin_create_company(
  company_name text,
  owner_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_owner uuid := coalesce(owner_id, actor);
  clean_name text := btrim(company_name);
  owner_banned_until timestamptz;
  new_company uuid;
begin
  if actor is null or not public.is_platform_admin() then
    raise exception 'La création d’entreprise est réservée à un administrateur actif.' using errcode = '42501';
  end if;
  if clean_name is null or length(clean_name) not between 1 and 120 then
    raise exception 'Le nom de l’entreprise doit contenir entre 1 et 120 caractères.' using errcode = '22023';
  end if;

  -- Onboarding and ownership transfer take the same Auth row lock. A normal
  -- owner cannot acquire two companies through concurrent requests.
  select banned_until into owner_banned_until from auth.users
    where id = target_owner for update;
  if not found or (owner_banned_until is not null and owner_banned_until > now()) then
    raise exception 'Ce propriétaire est supprimé ou suspendu.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.platform_admins where user_id = target_owner)
    and exists (select 1 from public.company_members where user_id = target_owner) then
    raise exception 'Ce compte appartient déjà à une entreprise.' using errcode = '23514';
  end if;

  insert into public.companies (name) values (clean_name) returning id into new_company;
  insert into public.company_members (company_id, user_id, role)
    values (new_company, target_owner, 'owner');
  insert into public.admin_audit_log (actor_id, target_user_id, company_id, action)
    values (actor, target_owner, new_company, 'create_company');
  return new_company;
end;
$$;
revoke all on function public.admin_create_company(text, uuid) from public, anon;
grant execute on function public.admin_create_company(text, uuid) to authenticated;

create or replace function public.admin_delete_company(
  target_company_id uuid,
  confirmation_name text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_name text;
begin
  if actor is null or not public.is_platform_admin() then
    raise exception 'La suppression d’entreprise est réservée à un administrateur actif.' using errcode = '42501';
  end if;
  if target_company_id is null or confirmation_name is null then
    raise exception 'L’entreprise et son nom de confirmation sont requis.' using errcode = '22023';
  end if;

  select name into current_name from public.companies
    where id = target_company_id for update;
  if not found then
    raise exception 'Cette entreprise n’existe plus. Actualisez la liste.' using errcode = 'P0002';
  end if;
  if btrim(confirmation_name) <> current_name then
    raise exception 'Le nom saisi ne correspond pas au nom actuel de l’entreprise.' using errcode = '22023';
  end if;

  -- The client FK uses RESTRICT: delete quotes first rather than relying on the
  -- order of company cascades. Clients, events, memberships and business
  -- notifications then disappear with the company; Auth accounts stay intact.
  delete from public.quotes where company_id = target_company_id;
  delete from public.companies where id = target_company_id;
  insert into public.admin_audit_log (actor_id, company_id, action)
    values (actor, target_company_id, 'delete_company');
  return target_company_id;
end;
$$;
revoke all on function public.admin_delete_company(uuid, text) from public, anon;
grant execute on function public.admin_delete_company(uuid, text) to authenticated;

notify pgrst, 'reload schema';
