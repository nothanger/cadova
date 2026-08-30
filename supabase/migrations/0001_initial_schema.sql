-- ============================================================================
-- Cadova FollowUp — initial schema (idempotent: safe to run multiple times)
-- Multi-tenant: companies isolated via Row Level Security (RLS).
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (preinstalled on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper: a trigger keeps updated_at correct without trusting the
-- frontend to send it. A trigger is server-side code that fires automatically
-- on INSERT/UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- TABLES
-- ===========================================================================

-- A company = one tenant using Cadova.
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which auth users belong to which company, and with what role.
-- Composite PK (company_id, user_id): a user appears once per company.
create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Clients belong to a company. A UNIQUE (company_id, id) is added so quotes can
-- reference it with a COMPOSITE foreign key (see quotes below).
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

-- Quotes belong to a company AND a client.
-- amount_cents is bigint (integer cents) — money is never stored as float.
create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  client_id    uuid not null,
  reference    text not null check (length(btrim(reference)) > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  sent_at      date,
  status       text not null default 'draft'
               check (status in ('draft', 'sent', 'accepted', 'refused')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Reference is unique WITHIN a company; two companies may both use DEV-001.
  unique (company_id, reference),

  -- COMPOSITE foreign key: guarantees at the DATABASE level that the quote's
  -- client belongs to the SAME company as the quote. Impossible for company A
  -- to attach a quote to a client of company B, even via a direct API call.
  constraint quotes_client_same_company_fkey
    foreign key (company_id, client_id)
    references public.clients (company_id, id)
    on delete restrict
);

-- ===========================================================================
-- updated_at triggers (drop-then-create so re-runs are clean)
-- ===========================================================================
drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- INDEXES
-- An index speeds up lookups on the indexed columns at the cost of extra
-- storage and slightly slower writes. We add only justified ones.
-- ===========================================================================
create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists clients_company_idx     on public.clients (company_id);
create index if not exists quotes_company_idx      on public.quotes (company_id);
create index if not exists quotes_client_idx       on public.quotes (client_id);
-- Serves the core FollowUp query (company + status + send date).
create index if not exists quotes_followup_idx     on public.quotes (company_id, status, sent_at);

-- ===========================================================================
-- SECURITY HELPERS (SECURITY DEFINER)
-- These run with the function owner's rights, bypassing RLS. That is REQUIRED
-- to avoid infinite recursion: a policy on company_members that itself queried
-- company_members would loop. search_path is pinned to prevent hijacking.
-- ===========================================================================
create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- ===========================================================================
-- ONBOARDING RPC
-- Creates the company AND the owner membership atomically (one transaction),
-- so we can never end up with a company that has no owner. SECURITY DEFINER so
-- the very first membership can be written before any exists.
-- ===========================================================================
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if company_name is null or length(btrim(company_name)) = 0 then
    raise exception 'Company name is required';
  end if;

  -- MVP rule: one company per user.
  if exists (select 1 from public.company_members where user_id = uid) then
    raise exception 'User already belongs to a company';
  end if;

  insert into public.companies (name)
  values (btrim(company_name))
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (new_company_id, uid, 'owner');

  return new_company_id;
end;
$$;

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.clients         enable row level security;
alter table public.quotes          enable row level security;

-- companies -----------------------------------------------------------------
drop policy if exists companies_select_members on public.companies;
create policy companies_select_members on public.companies
  for select using (public.is_company_member(id));

drop policy if exists companies_update_owner on public.companies;
create policy companies_update_owner on public.companies
  for update using (public.is_company_owner(id))
  with check (public.is_company_owner(id));
-- (No INSERT policy: companies are created only via create_company_with_owner.)
-- (No DELETE policy: deletion is not part of the MVP UI.)

-- company_members -----------------------------------------------------------
-- Members may read the membership rows of their own company. Writes happen only
-- through the onboarding RPC (SECURITY DEFINER), so no INSERT/UPDATE/DELETE
-- policies are exposed.
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members
  for select using (public.is_company_member(company_id));

-- clients -------------------------------------------------------------------
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (public.is_company_member(company_id));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (public.is_company_member(company_id));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete using (public.is_company_member(company_id));

-- quotes --------------------------------------------------------------------
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select using (public.is_company_member(company_id));
drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes
  for insert with check (public.is_company_member(company_id));
drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes
  for delete using (public.is_company_member(company_id));

-- ===========================================================================
-- GRANTS  (CRITICAL)
-- RLS decides WHICH ROWS a role may touch, but the role still needs table-level
-- privileges to touch the table AT ALL. Without these grants PostgREST does not
-- even expose the tables to logged-in users -> error PGRST205
-- ("Could not find the table ... in the schema cache"). RLS keeps every query
-- confined to the caller's own company regardless of these broad grants.
-- ===========================================================================
grant usage on schema public to authenticated, anon;

grant select, update                     on public.companies       to authenticated;
grant select                             on public.company_members to authenticated;
grant select, insert, update, delete     on public.clients         to authenticated;
grant select, insert, update, delete     on public.quotes          to authenticated;

-- Least privilege on the SECURITY DEFINER functions: revoke from everyone,
-- then grant execute only to authenticated users.
revoke all on function public.create_company_with_owner(text) from public;
grant execute on function public.create_company_with_owner(text) to authenticated;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.is_company_owner(uuid) from public;
grant execute on function public.is_company_owner(uuid) to authenticated;

-- ===========================================================================
-- Tell PostgREST to reload its schema cache immediately.
-- ===========================================================================
notify pgrst, 'reload schema';
