create table if not exists public.candidatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  position text not null,
  type text not null check (type in ('stage', 'alternance', 'job')),
  status text not null check (status in ('À envoyer', 'Envoyé', 'Relance à faire', 'Relancé', 'Entretien', 'Refusé', 'Accepté')),
  applied_at date,
  follow_up_date date,
  email text,
  notes text,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null default '',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emails_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidature_id uuid not null references public.candidatures(id) on delete cascade,
  recipient text not null,
  subject text not null,
  content text not null,
  status text not null default 'queued' check (status in ('queued', 'sent')),
  sent_at timestamptz not null default now()
);

alter table public.candidatures enable row level security;
alter table public.email_templates enable row level security;
alter table public.emails_sent enable row level security;

drop policy if exists "candidatures_select_own" on public.candidatures;
create policy "candidatures_select_own" on public.candidatures
  for select using (auth.uid() = user_id);

drop policy if exists "candidatures_insert_own" on public.candidatures;
create policy "candidatures_insert_own" on public.candidatures
  for insert with check (auth.uid() = user_id);

drop policy if exists "candidatures_update_own" on public.candidatures;
create policy "candidatures_update_own" on public.candidatures
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "candidatures_delete_own" on public.candidatures;
create policy "candidatures_delete_own" on public.candidatures
  for delete using (auth.uid() = user_id);

drop policy if exists "email_templates_all_own" on public.email_templates;
create policy "email_templates_all_own" on public.email_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "emails_sent_select_own" on public.emails_sent;
create policy "emails_sent_select_own" on public.emails_sent
  for select using (auth.uid() = user_id);

drop policy if exists "emails_sent_insert_own" on public.emails_sent;
create policy "emails_sent_insert_own" on public.emails_sent
  for insert with check (auth.uid() = user_id);

create index if not exists candidatures_user_status_idx on public.candidatures(user_id, status);
create index if not exists candidatures_follow_up_idx on public.candidatures(user_id, follow_up_date);
create index if not exists emails_sent_candidature_idx on public.emails_sent(candidature_id, sent_at desc);
