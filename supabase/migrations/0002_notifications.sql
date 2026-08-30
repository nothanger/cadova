-- ============================================================================
-- Cadova FollowUp — migration 0002 : notifications + préférences email
--
-- NOUVEAUTÉS :
--   1. company_members.email_followup_reminders  — toggle opt-out email
--   2. table notifications                        — in-app + idempotence emails
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Préférence email sur company_members
--    Par défaut true : l'utilisateur reçoit les rappels sauf s'il désactive.
-- ---------------------------------------------------------------------------
alter table public.company_members
  add column if not exists email_followup_reminders boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Table notifications
--
--    Deux types MVP :
--      quote_followup_due      — un devis spécifique dépasse J+3
--      daily_followup_summary  — résumé quotidien (related_quote_id = null)
--
--    Stratégie anti-doublons :
--      UNIQUE (user_id, related_quote_id, type, notification_date)
--      Pour le résumé quotidien on utilise related_quote_id = NULL.
--      PostgreSQL traite NULL = NULL comme non-égal dans UNIQUE, donc on
--      crée un index partiel distinct pour les résumés.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id               uuid        primary key default gen_random_uuid(),
  company_id       uuid        not null references public.companies (id) on delete cascade,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  type             text        not null check (type in ('quote_followup_due', 'daily_followup_summary')),
  title            text        not null,
  message          text        not null,
  related_quote_id uuid        references public.quotes (id) on delete set null,
  notification_date date       not null default current_date,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- Index de lecture courant (notifications non lues d'un user)
create index if not exists notifications_user_unread
  on public.notifications (user_id, read_at)
  where read_at is null;

-- Anti-doublon pour quote_followup_due (related_quote_id non nul)
create unique index if not exists notifications_followup_due_once
  on public.notifications (user_id, related_quote_id, type, notification_date)
  where related_quote_id is not null;

-- Anti-doublon pour daily_followup_summary (related_quote_id nul)
create unique index if not exists notifications_daily_summary_once
  on public.notifications (user_id, type, notification_date)
  where related_quote_id is null;

-- ---------------------------------------------------------------------------
-- 3. RLS sur notifications
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

-- Un utilisateur ne voit que ses propres notifications
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

-- Seule l'Edge Function (service role) peut insérer (INSERT FROM SERVER)
-- Les utilisateurs peuvent marquer leurs notifications comme lues (UPDATE read_at)
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pas de DELETE côté client, pas d'INSERT côté client
-- (l'insertion se fait via service role dans l'Edge Function)
