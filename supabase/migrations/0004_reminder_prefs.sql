-- ============================================================================
-- Cadova FollowUp — migration 0004 : préférences de relance par membre
--
-- NOUVEAUTÉS :
--   1. company_members.followup_delay_days  — délai J+N avant « À relancer »
--   2. company_members.reminder_hour        — heure d'envoi email (Europe/Paris)
-- ============================================================================

alter table public.company_members
  add column if not exists followup_delay_days integer not null default 3
    check (followup_delay_days between 1 and 30);

alter table public.company_members
  add column if not exists reminder_hour integer not null default 8
    check (reminder_hour between 0 and 23);
