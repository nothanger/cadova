-- ============================================================================
-- Cadova FollowUp — migration 0003 : scheduler pg_cron
--
-- Déclenche l'Edge Function send-followup-reminders tous les matins à 07:00 UTC
-- (= 08:00 Europe/Paris en hiver, 09:00 en été — acceptable pour un MVP).
--
-- PRÉREQUIS : activer l'extension pg_cron dans Supabase
--   Dashboard → Database → Extensions → pg_cron → Enable
--
-- VARIABLES À REMPLACER avant d'exécuter :
--   <SUPABASE_PROJECT_REF>  — ID du projet Supabase (ex. slldepvthxeetakhxzpu)
--   <SUPABASE_SERVICE_ROLE_KEY> — clé service_role (jamais commit dans Git)
-- ============================================================================

-- Activer pg_cron (idempotent)
create extension if not exists pg_cron;

-- Supprimer le job s'il existe déjà (idempotent)
select cron.unschedule('cadova-followup-reminders')
  where exists (
    select 1 from cron.job where jobname = 'cadova-followup-reminders'
  );

-- Planifier : 07:00 UTC chaque jour
select cron.schedule(
  'cadova-followup-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url    := 'https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/send-followup-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
