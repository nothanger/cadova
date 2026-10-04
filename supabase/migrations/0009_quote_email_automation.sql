-- Email automation is explicitly enabled per quote. No secret or live sender
-- configuration belongs in this migration; the worker starts disabled.
create table public.quote_followup_service_state (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  configured boolean not null default false,
  status_code text not null default 'disabled'
    check (status_code in ('ready','disabled','email_configuration_missing')),
  updated_at timestamptz not null default now()
);
insert into public.quote_followup_service_state(id) values(true);
alter table public.quote_followup_service_state enable row level security;
revoke all on public.quote_followup_service_state from public,anon,authenticated,service_role;
grant select,update on public.quote_followup_service_state to service_role;

create function public.valid_followup_email(value text) returns boolean
language sql immutable set search_path='' as $function$
  select value is not null and length(value)<=254 and position('..' in value)=0
    and left(value,1)<>'.' and position('.@' in value)=0 and value ~
    $pattern$^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$$pattern$;
$function$;
revoke all on function public.valid_followup_email(text) from public,anon;
grant execute on function public.valid_followup_email(text) to authenticated,service_role;

create table public.company_email_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  reply_to text check(reply_to is null or public.valid_followup_email(reply_to)),
  automation_paused boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.company_email_settings enable row level security;
create policy company_email_settings_select on public.company_email_settings for select to authenticated
  using(public.is_company_member(company_id));
revoke all on public.company_email_settings from public,anon,authenticated;
grant select on public.company_email_settings to authenticated;
grant select,insert,update on public.company_email_settings to service_role;

create table public.quote_followup_automations (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  paused boolean not null default false,
  generation integer not null default 0 check(generation>=0),
  activated_by uuid references auth.users(id) on delete set null,
  first_delay_days integer not null default 5 check(first_delay_days between 1 and 90),
  second_delay_days integer not null default 12 check(second_delay_days between 1 and 90 and second_delay_days>first_delay_days),
  subject_template text not null default 'Suivi du devis {{quote_reference}}',
  body_template text not null default E'Bonjour {{client_name}},\n\nAvez-vous pu consulter le devis {{quote_reference}} ? Je reste disponible pour répondre à vos questions.\n\nBien cordialement,\n{{company_name}}',
  next_send_at timestamptz,
  stop_reason text,
  updated_at timestamptz not null default now()
);
create table public.quote_followup_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  generation integer not null,
  step smallint not null check(step in (1,2)),
  scheduled_at timestamptz not null,
  next_attempt_at timestamptz not null,
  status text not null default 'queued' check(status in ('queued','processing','sent','failed','cancelled','delivery_unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  recipient_email text,
  reply_to text,
  sender text,
  subject text,
  body text,
  company_name text,
  provider_payload jsonb,
  provider_message_id text,
  ambiguous boolean not null default false,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(quote_id,generation,step)
);
-- A model/calendar edit must never resend an already completed sequence step.
create unique index quote_followup_sent_step_once on public.quote_followup_jobs(quote_id,step) where status='sent';
create index quote_followup_jobs_due_idx on public.quote_followup_jobs(next_attempt_at) where status in ('queued','processing');
create table public.quote_followup_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.quote_followup_jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  attempt_number integer not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  result text check(result in ('sent','retry','failed','cancelled','delivery_unknown')),
  error_code text,
  unique(job_id,attempt_number)
);
-- Quote events formerly had two independent FKs. A response must belong to the
-- same tenant as its quote before it can stop automation for that quote.
alter table public.quotes add constraint quotes_company_id_id_key unique(company_id,id);
alter table public.quote_events drop constraint quote_events_quote_id_fkey;
alter table public.quote_events add constraint quote_events_quote_same_company_fkey
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade;
alter table public.quote_followup_jobs add constraint quote_followup_jobs_same_company_fkey
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade;
alter table public.quote_followup_automations add constraint quote_followup_automations_same_company_fkey
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade;
alter table public.quote_followup_automations enable row level security;
alter table public.quote_followup_jobs enable row level security;
alter table public.quote_followup_attempts enable row level security;
create policy quote_followup_automations_select on public.quote_followup_automations for select to authenticated using(public.is_company_member(company_id));
create policy quote_followup_jobs_select on public.quote_followup_jobs for select to authenticated using(public.is_company_member(company_id));
create policy quote_followup_attempts_select on public.quote_followup_attempts for select to authenticated using(public.is_company_member(company_id));
revoke all on public.quote_followup_automations,public.quote_followup_jobs,public.quote_followup_attempts from public,anon,authenticated;
grant select on public.quote_followup_automations,public.quote_followup_jobs,public.quote_followup_attempts to authenticated;
grant select,insert,update on public.quote_followup_automations,public.quote_followup_jobs,public.quote_followup_attempts to service_role;

alter table public.quote_events add column automation_job_id uuid references public.quote_followup_jobs(id) on delete set null;
alter table public.quote_events add column delivery_status text check(delivery_status in ('sent','failed','delivery_unknown'));
alter table public.quote_events drop constraint quote_events_event_type_check;
alter table public.quote_events add constraint quote_events_event_type_check check(event_type in (
  'sent','followup','response','note','status_change','followup_scheduled','followup_auto_sent','followup_auto_failed'
));
create unique index quote_events_automation_job_once on public.quote_events(automation_job_id,event_type) where automation_job_id is not null;
drop policy quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events for insert to authenticated with check(
  public.is_company_member(company_id) and (created_by is null or created_by=auth.uid())
  and event_type not in ('followup_auto_sent','followup_auto_failed') and automation_job_id is null and delivery_status is null
);
drop policy quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events for update to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and event_type not in ('followup_auto_sent','followup_auto_failed'))
  with check(public.is_company_member(company_id) and automation_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed'));
drop policy quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events for delete to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and event_type not in ('followup_auto_sent','followup_auto_failed'));
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in (
  'quote_followup_due','daily_followup_summary','support_message','admin_message','admin_announcement','quote_followup_sent','quote_followup_failed'
));
alter table public.notifications add column automation_job_id uuid references public.quote_followup_jobs(id) on delete cascade;
create unique index notifications_automation_job_once on public.notifications(user_id,automation_job_id,type) where automation_job_id is not null;
-- Quote-specific business reminders retain their old deduplication. Automation
-- results use job IDs and may include two messages on the same calendar day.
drop index public.notifications_followup_due_once;
create unique index notifications_followup_due_once on public.notifications(user_id,related_quote_id,type,notification_date)
  where related_quote_id is not null and type='quote_followup_due';

create function public.read_quote_followup_service_status() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.current_user_is_active() then raise exception 'Compte actif requis.' using errcode='42501'; end if;
  return (select jsonb_build_object('ready',enabled and configured,'code',status_code) from public.quote_followup_service_state where id);
end;
$$;
revoke all on function public.read_quote_followup_service_status() from public,anon;
grant execute on function public.read_quote_followup_service_status() to authenticated;
create function public.set_quote_followup_service_status(p_enabled boolean,p_configured boolean,p_status_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_enabled is null or p_configured is null or p_status_code is null or p_status_code <> (case when not p_configured then 'email_configuration_missing' when not p_enabled then 'disabled' else 'ready' end) then
    raise exception 'État du service invalide.' using errcode='22023';
  end if;
  update public.quote_followup_service_state set enabled=p_enabled,configured=p_configured,status_code=p_status_code,updated_at=clock_timestamp() where id;
end;
$$;
revoke all on function public.set_quote_followup_service_status(boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.set_quote_followup_service_status(boolean,boolean,text) to service_role;

create function public.set_company_email_settings(p_company_id uuid,p_reply_to text,p_automation_paused boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; contact text:=lower(btrim(p_reply_to));
begin
  if not public.is_company_owner(p_company_id) then raise exception 'Seul un propriétaire actif peut modifier ce contact.' using errcode='42501'; end if;
  if not public.valid_followup_email(contact) then raise exception 'Saisissez une adresse email de réponse valide.' using errcode='22023'; end if;
  insert into public.company_email_settings(company_id,reply_to,automation_paused) values(p_company_id,contact,coalesce(p_automation_paused,false))
    on conflict(company_id) do update set reply_to=excluded.reply_to,automation_paused=coalesce(p_automation_paused,company_email_settings.automation_paused),updated_at=clock_timestamp();
  select to_jsonb(s) into result from public.company_email_settings s where company_id=p_company_id;
  return result;
end;
$$;
revoke all on function public.set_company_email_settings(uuid,text,boolean) from public,anon;
grant execute on function public.set_company_email_settings(uuid,text,boolean) to authenticated;

create function public.get_quote_followup_automation(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
  select company_id into company from public.quotes where id=p_quote_id;
  if not found then raise exception 'Devis introuvable.' using errcode='P0002'; end if;
  if not public.is_company_member(company) then raise exception 'Ce devis est inaccessible.' using errcode='42501'; end if;
  return(select to_jsonb(a) from public.quote_followup_automations a where quote_id=p_quote_id);
end;
$$;
revoke all on function public.get_quote_followup_automation(uuid) from public,anon;
grant execute on function public.get_quote_followup_automation(uuid) to authenticated;

-- Internal eligibility uses the activation actor, not the worker's Auth UID.
create function public.quote_followup_block_reason(p_job_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; a public.quote_followup_automations%rowtype;
  q public.quotes%rowtype; contact text; recipient text; today date:=(now() at time zone 'Europe/Paris')::date;
begin
  select * into j from public.quote_followup_jobs where id=p_job_id;
  select * into a from public.quote_followup_automations where quote_id=j.quote_id;
  select * into q from public.quotes where id=j.quote_id;
  if q.id is null or q.company_id<>j.company_id or a.company_id<>j.company_id then return 'quote_missing'; end if;
  if not a.enabled then return coalesce(a.stop_reason,'disabled'); end if;
  if a.generation<>j.generation then return 'generation_changed'; end if;
  if exists(select 1 from public.quote_followup_jobs sent where sent.quote_id=j.quote_id and sent.step=j.step and sent.status='sent' and sent.id<>j.id) then return 'step_completed'; end if;
  if a.paused then return 'paused'; end if;
  if q.status<>'sent' then return q.status; end if;
  if q.expires_at is not null and q.expires_at<=today then return 'expired'; end if;
  if exists(select 1 from public.quote_events where quote_id=q.id and event_type='response') then return 'response_received'; end if;
  if not exists(select 1 from auth.users u where u.id=a.activated_by and (u.banned_until is null or u.banned_until<=now()) and (
    exists(select 1 from public.platform_admins where user_id=u.id) or exists(select 1 from public.company_members where company_id=j.company_id and user_id=u.id)
  )) then return 'actor_unavailable'; end if;
  if not exists(select 1 from public.quote_followup_service_state where id and enabled and configured) then return 'service_unavailable'; end if;
  select reply_to into contact from public.company_email_settings where company_id=j.company_id and not automation_paused;
  if not public.valid_followup_email(contact) then return 'company_paused'; end if;
  select email into recipient from public.clients where id=q.client_id and company_id=j.company_id;
  if not public.valid_followup_email(recipient) then return 'invalid_recipient'; end if;
  if j.recipient_email is not null and recipient is distinct from j.recipient_email then return 'client_email_changed'; end if;
  if j.reply_to is not null and contact is distinct from j.reply_to then return 'contact_changed'; end if;
  return null;
end;
$$;
revoke all on function public.quote_followup_block_reason(uuid) from public,anon,authenticated;

create function public.stop_quote_followup_automation(p_quote_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.quotes where id=p_quote_id for update;
  update public.quote_followup_automations set enabled=false,stop_reason=p_reason,next_send_at=null,updated_at=clock_timestamp() where quote_id=p_quote_id;
  update public.quote_followup_jobs set status=case when ambiguous then 'delivery_unknown' else 'cancelled' end,
    last_error_code=p_reason,updated_at=clock_timestamp() where quote_id=p_quote_id and status='queued' and provider_message_id is null;
end;
$$;
revoke all on function public.stop_quote_followup_automation(uuid,text) from public,anon,authenticated;

create function public.save_quote_followup_automation(
  p_quote_id uuid,p_enabled boolean,p_first_delay_days integer default 5,p_second_delay_days integer default 12,
  p_subject_template text default null,p_body_template text default null,p_next_send_date date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; a public.quote_followup_automations%rowtype; contact text; recipient text;
  subject_text text; body_text text; today date:=(now() at time zone 'Europe/Paris')::date;
  first_date date; second_date date; next_step integer; version integer;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Devis introuvable.' using errcode='P0002'; end if;
  if not public.is_company_member(q.company_id) then raise exception 'Ce devis est inaccessible.' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Choisissez l’état de l’automatisation.' using errcode='22023'; end if;
  insert into public.quote_followup_automations(quote_id,company_id) values(q.id,q.company_id) on conflict(quote_id) do nothing;
  select * into a from public.quote_followup_automations where quote_id=q.id for update;
  if not p_enabled and p_subject_template is null and p_body_template is null then
    perform public.stop_quote_followup_automation(q.id,'disabled');
    return public.get_quote_followup_automation(q.id);
  end if;
  if exists(select 1 from public.quote_followup_jobs where quote_id=q.id and
    (status='processing' or status='delivery_unknown' or (first_attempt_at is not null and status='queued'))) then
    raise exception 'Un envoi est en cours de résolution. Vous pouvez le mettre en pause ou arrêter la suite.' using errcode='23514';
  end if;
  subject_text:=btrim(coalesce(p_subject_template,a.subject_template));
  body_text:=btrim(coalesce(p_body_template,a.body_template));
  subject_text:=regexp_replace(subject_text,'\{\{\s*(client_name|quote_reference|company_name|amount_formatted)\s*\}\}','{{\1}}','g');
  body_text:=regexp_replace(body_text,'\{\{\s*(client_name|quote_reference|company_name|amount_formatted)\s*\}\}','{{\1}}','g');
  if p_first_delay_days is null or p_first_delay_days not between 1 and 90 or p_second_delay_days is null
    or p_second_delay_days not between 1 and 90 or p_second_delay_days<=p_first_delay_days then
    raise exception 'Choisissez deux délais croissants entre 1 et 90 jours.' using errcode='22023';
  end if;
  if subject_text is null or length(subject_text) not between 1 and 160 or subject_text ~ E'[\r\n]'
    or body_text is null or length(body_text) not between 1 and 4000 then
    raise exception 'Vérifiez l’objet (160 caractères) et le message (4 000 caractères).' using errcode='22023';
  end if;
  if regexp_replace(subject_text||body_text,'\{\{(client_name|quote_reference|company_name|amount_formatted)\}\}','','g') ~ '\{\{|\}\}' then
    raise exception 'Les variables autorisées sont client_name, quote_reference, company_name et amount_formatted.' using errcode='22023';
  end if;
  if p_next_send_date is not null and p_next_send_date<today+1 then
    raise exception 'La prochaine date doit être à partir de demain.' using errcode='22023';
  end if;
  if p_enabled then
    if not exists(select 1 from public.quote_followup_service_state where id and enabled and configured) then
      raise exception 'Le service email doit être configuré avant l’activation.' using errcode='23514';
    end if;
    if q.status<>'sent' or q.sent_at is null or (q.expires_at is not null and q.expires_at<=today)
      or exists(select 1 from public.quote_events where quote_id=q.id and event_type='response') then
      raise exception 'Ce devis ne peut plus être relancé automatiquement.' using errcode='23514';
    end if;
    select reply_to into contact from public.company_email_settings where company_id=q.company_id and not automation_paused;
    select email into recipient from public.clients where id=q.client_id and company_id=q.company_id;
    if not public.valid_followup_email(contact) or not public.valid_followup_email(recipient) then
      raise exception 'Renseignez une adresse client et une adresse de réponse valides.' using errcode='23514';
    end if;
  end if;
  version:=a.generation+1;
  update public.quote_followup_jobs set status='cancelled',last_error_code='configuration_changed',updated_at=clock_timestamp()
    where quote_id=q.id and status='queued' and provider_message_id is null;
  update public.quote_followup_automations set enabled=p_enabled,paused=case when a.enabled and p_enabled then a.paused else false end,generation=version,activated_by=auth.uid(),
    first_delay_days=p_first_delay_days,second_delay_days=p_second_delay_days,subject_template=subject_text,body_template=body_text,
    stop_reason=case when p_enabled then null else 'disabled' end,next_send_at=null,updated_at=clock_timestamp() where quote_id=q.id;
  if p_enabled then
    next_step:=case when exists(select 1 from public.quote_followup_jobs where quote_id=q.id and step=1 and status='sent') then 2 else 1 end;
    if exists(select 1 from public.quote_followup_jobs where quote_id=q.id and step=2 and status='sent') then
      perform public.stop_quote_followup_automation(q.id,'completed');
      return public.get_quote_followup_automation(q.id);
    end if;
    first_date:=coalesce(p_next_send_date,greatest(q.sent_at+p_first_delay_days,today+1));
    if next_step=2 then
      second_date:=coalesce(p_next_send_date,greatest(q.sent_at+p_second_delay_days,today+1));
    else
      second_date:=greatest(q.sent_at+p_second_delay_days,first_date+(p_second_delay_days-p_first_delay_days));
      insert into public.quote_followup_jobs(quote_id,company_id,generation,step,scheduled_at,next_attempt_at)
        values(q.id,q.company_id,version,1,(first_date+time '09:00') at time zone 'Europe/Paris',(first_date+time '09:00') at time zone 'Europe/Paris');
    end if;
    insert into public.quote_followup_jobs(quote_id,company_id,generation,step,scheduled_at,next_attempt_at)
      values(q.id,q.company_id,version,2,(second_date+time '09:00') at time zone 'Europe/Paris',(second_date+time '09:00') at time zone 'Europe/Paris');
    update public.quote_followup_automations set next_send_at=(select min(scheduled_at) from public.quote_followup_jobs where quote_id=q.id and generation=version and status='queued') where quote_id=q.id;
  end if;
  return public.get_quote_followup_automation(q.id);
end;
$$;
revoke all on function public.save_quote_followup_automation(uuid,boolean,integer,integer,text,text,date) from public,anon;
grant execute on function public.save_quote_followup_automation(uuid,boolean,integer,integer,text,text,date) to authenticated;

create function public.set_quote_followup_automation_paused(p_quote_id uuid,p_paused boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
  select company_id into company from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Devis introuvable.' using errcode='P0002'; end if;
  if not public.is_company_member(company) then raise exception 'Ce devis est inaccessible.' using errcode='42501'; end if;
  if p_paused is null then raise exception 'Choisissez l’état de pause.' using errcode='22023'; end if;
  update public.quote_followup_automations set paused=p_paused,updated_at=clock_timestamp() where quote_id=p_quote_id;
  return public.get_quote_followup_automation(p_quote_id);
end;
$$;
revoke all on function public.set_quote_followup_automation_paused(uuid,boolean) from public,anon;
grant execute on function public.set_quote_followup_automation_paused(uuid,boolean) to authenticated;

create function public.stop_quote_followups_on_business_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='quote_events' then
    if new.event_type='response' then perform public.stop_quote_followup_automation(new.quote_id,'response_received'); end if;
  else
    if new.status<>'sent' then perform public.stop_quote_followup_automation(new.id,new.status);
    elsif new.expires_at is not null and new.expires_at<=(now() at time zone 'Europe/Paris')::date then
      perform public.stop_quote_followup_automation(new.id,'expired');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.stop_quote_followups_on_business_change() from public,anon,authenticated,service_role;
create trigger quote_followups_stop_on_quote before update of status,expires_at on public.quotes for each row execute function public.stop_quote_followups_on_business_change();
create trigger quote_followups_stop_on_response after insert or update of event_type on public.quote_events for each row execute function public.stop_quote_followups_on_business_change();
create function public.record_quote_response(p_quote_id uuid,p_content text) returns uuid
language plpgsql security definer set search_path='' as $$
declare company uuid; event_id uuid;
begin
  select company_id into company from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Devis introuvable.' using errcode='P0002'; end if;
  if not public.is_company_member(company) then raise exception 'Ce devis est inaccessible.' using errcode='42501'; end if;
  if p_content is null or length(btrim(p_content)) not between 1 and 4000 then raise exception 'La réponse doit contenir entre 1 et 4 000 caractères.' using errcode='22023'; end if;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by) values(company,p_quote_id,'response',btrim(p_content),auth.uid()) returning id into event_id;
  return event_id;
end;
$$;
revoke all on function public.record_quote_response(uuid,text) from public,anon;
grant execute on function public.record_quote_response(uuid,text) to authenticated;

create function public.finalize_quote_followup_failure(p_job_id uuid,p_status text,p_error text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; actor uuid;
begin
  select * into j from public.quote_followup_jobs where id=p_job_id;
  select activated_by into actor from public.quote_followup_automations where quote_id=j.quote_id;
  update public.quote_followup_jobs set status=p_status,last_error_code=p_error,lease_until=null,updated_at=clock_timestamp() where id=j.id;
  update public.quote_followup_attempts set finished_at=clock_timestamp(),result=p_status,error_code=p_error where job_id=j.id and attempt_number=j.attempts;
  if p_status in ('failed','delivery_unknown') then
    insert into public.quote_events(company_id,quote_id,event_type,content,created_by,automation_job_id,delivery_status)
      values(j.company_id,j.quote_id,'followup_auto_failed',case when p_status='delivery_unknown' then 'Le service d’envoi n’a pas confirmé le résultat. Aucun nouvel envoi automatique.' else 'La relance automatique n’a pas été envoyée.' end,actor,j.id,p_status)
      on conflict(automation_job_id,event_type) where automation_job_id is not null do nothing;
    if actor is not null then
      insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,automation_job_id)
        values(j.company_id,actor,'quote_followup_failed',case when p_status='delivery_unknown' then 'Envoi à vérifier' else 'Relance non envoyée' end,
          'Consultez l’historique du devis pour vérifier cette relance.',j.quote_id,j.id)
        on conflict(user_id,automation_job_id,type) where automation_job_id is not null do nothing;
    end if;
    perform public.stop_quote_followup_automation(j.quote_id,case when p_status='delivery_unknown' then 'delivery_unknown' else 'delivery_failed' end);
  end if;
end;
$$;
revoke all on function public.finalize_quote_followup_failure(uuid,text,text) from public,anon,authenticated;

create function public.claim_quote_followup_jobs(p_batch_size integer default 10,p_lease_seconds integer default 300)
returns table(id uuid,lease_token uuid,attempts integer,first_attempt_at timestamptz,provider_message_id text)
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; reason text; token uuid; previous public.quote_followup_automations%rowtype; business_quote public.quotes%rowtype;
begin
  if p_batch_size not between 1 and 10 or p_batch_size is null or p_lease_seconds not between 120 and 900 or p_lease_seconds is null then
    raise exception 'Réservation invalide.' using errcode='22023';
  end if;
  if not exists(select 1 from public.quote_followup_service_state where quote_followup_service_state.id and enabled and configured) then return; end if;
  for previous in select a.* from public.quote_followup_automations a join public.quotes q on q.id=a.quote_id
    where a.enabled and (q.status<>'sent' or (q.expires_at is not null and q.expires_at<=(now() at time zone 'Europe/Paris')::date)) order by a.quote_id loop
    select * into business_quote from public.quotes where quotes.id=previous.quote_id for update skip locked;
    if not found or not exists(select 1 from public.quote_followup_automations where quote_id=previous.quote_id and enabled) then continue; end if;
    if business_quote.status<>'sent' then
      perform public.stop_quote_followup_automation(previous.quote_id,business_quote.status);
    elsif business_quote.expires_at is not null and business_quote.expires_at<=(now() at time zone 'Europe/Paris')::date then
      perform public.stop_quote_followup_automation(previous.quote_id,'expired');
    end if;
  end loop;
  for j in select jobs.* from public.quote_followup_jobs jobs
    where (jobs.status='queued' or (jobs.status='processing' and jobs.lease_until<clock_timestamp()))
      and (jobs.provider_message_id is not null or (jobs.next_attempt_at<=clock_timestamp()
        and coalesce(public.quote_followup_block_reason(jobs.id),'') not in ('paused','company_paused','service_unavailable')
        and (jobs.step=1 or exists(select 1 from public.quote_followup_jobs earlier where earlier.quote_id=jobs.quote_id and earlier.step=1 and earlier.status='sent'))))
    order by jobs.next_attempt_at,jobs.id limit p_batch_size
  loop
    -- Take the quote lock BEFORE the job lock, matching user configuration and
    -- status/response writes. Recheck the candidate after acquiring both locks.
    perform 1 from public.quotes where quotes.id=j.quote_id for update skip locked;
    if not found then continue; end if;
    select * into j from public.quote_followup_jobs where quote_followup_jobs.id=j.id for update skip locked;
    if not found or (j.status<>'queued' and not(j.status='processing' and j.lease_until<clock_timestamp())) then continue; end if;
    if j.provider_message_id is null and j.next_attempt_at>clock_timestamp() then continue; end if;
    reason:=public.quote_followup_block_reason(j.id);
    if j.provider_message_id is null and reason in ('paused','company_paused','service_unavailable') then continue; end if;
    if j.status='processing' then
      update public.quote_followup_attempts set finished_at=clock_timestamp(),result='retry',error_code='lease_expired' where job_id=j.id and attempt_number=j.attempts and finished_at is null;
      if j.first_attempt_at is not null and j.provider_message_id is null then
        update public.quote_followup_jobs set ambiguous=true where quote_followup_jobs.id=j.id;
        j.ambiguous:=true;
      end if;
    end if;
    if j.provider_message_id is null and (j.attempts>=5 or (j.first_attempt_at is not null and j.first_attempt_at<clock_timestamp()-interval '23 hours')) then
      perform public.finalize_quote_followup_failure(j.id,case when j.ambiguous or j.first_attempt_at is not null then 'delivery_unknown' else 'failed' end,'attempt_limit');
      continue;
    end if;
    if j.provider_message_id is null and reason is not null then
      if j.ambiguous then perform public.finalize_quote_followup_failure(j.id,'delivery_unknown',reason);
      elsif reason in ('generation_changed','step_completed') then
        update public.quote_followup_jobs set status='cancelled',last_error_code=reason where quote_followup_jobs.id=j.id;
      else
        perform public.stop_quote_followup_automation(j.quote_id,reason);
        update public.quote_followup_jobs set status='cancelled',last_error_code=reason where quote_followup_jobs.id=j.id;
      end if;
      continue;
    end if;
    token:=gen_random_uuid();
    update public.quote_followup_jobs set status='processing',lease_token=token,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
      attempts=quote_followup_jobs.attempts+case when j.provider_message_id is null then 1 else 0 end,updated_at=clock_timestamp() where quote_followup_jobs.id=j.id
      returning quote_followup_jobs.attempts into j.attempts;
    insert into public.quote_followup_attempts(job_id,company_id,attempt_number) values(j.id,j.company_id,j.attempts) on conflict(job_id,attempt_number) do nothing;
    id:=j.id;lease_token:=token;attempts:=j.attempts;first_attempt_at:=j.first_attempt_at;provider_message_id:=j.provider_message_id;
    return next;
  end loop;
end;
$$;
revoke all on function public.claim_quote_followup_jobs(integer,integer) from public,anon,authenticated;
grant execute on function public.claim_quote_followup_jobs(integer,integer) to service_role;

create function public.lock_quote_followup_job(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select quote_id into target from public.quote_followup_jobs where id=p_job_id;
  perform 1 from public.quotes where id=target for update;
  if not found then raise exception 'Envoi introuvable.' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.lock_quote_followup_job(uuid) from public,anon,authenticated,service_role;

create function public.prepare_quote_followup_send(p_job_id uuid,p_lease_token uuid,p_sender text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; a public.quote_followup_automations%rowtype;
  q public.quotes%rowtype; client public.clients%rowtype; company public.companies%rowtype; reason text; subject_text text; body_text text;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  reason:=public.quote_followup_block_reason(j.id);
  if reason is not null then
    if reason in ('paused','company_paused','service_unavailable') and not j.ambiguous then
      update public.quote_followup_jobs set status='queued',lease_until=null,last_error_code=reason where id=j.id;
    elsif reason in ('generation_changed','step_completed') then
      update public.quote_followup_jobs set status='cancelled',lease_until=null,last_error_code=reason where id=j.id;
    elsif j.ambiguous then perform public.finalize_quote_followup_failure(j.id,'delivery_unknown',reason);
    else
      perform public.stop_quote_followup_automation(j.quote_id,reason);
      update public.quote_followup_jobs set status='cancelled',lease_until=null,last_error_code=reason where id=j.id;
    end if;
    return jsonb_build_object('allowed',false,'reason',reason);
  end if;
  if j.provider_payload is null then
    if p_sender is null or length(p_sender) not between 1 and 320 or p_sender~E'[\r\n]' then raise exception 'Expéditeur invalide.' using errcode='22023'; end if;
    select * into a from public.quote_followup_automations where quote_id=j.quote_id;
    select * into q from public.quotes where id=j.quote_id;
    select * into client from public.clients where id=q.client_id and company_id=j.company_id;
    select * into company from public.companies where id=j.company_id;
    subject_text:=replace(replace(replace(replace(a.subject_template,'{{client_name}}',client.name),'{{quote_reference}}',q.reference),'{{company_name}}',company.name),'{{amount_formatted}}',replace(to_char(q.amount_cents::numeric/100,'FM999999999999999990.00'),'.',',')||' €');
    body_text:=replace(replace(replace(replace(a.body_template,'{{client_name}}',client.name),'{{quote_reference}}',q.reference),'{{company_name}}',company.name),'{{amount_formatted}}',replace(to_char(q.amount_cents::numeric/100,'FM999999999999999990.00'),'.',',')||' €');
    if length(subject_text)>160 or subject_text~E'[\r\n]' or length(body_text)>8000 then
      perform public.finalize_quote_followup_failure(j.id,'failed','invalid_template');
      return jsonb_build_object('allowed',false,'reason','invalid_template');
    end if;
    update public.quote_followup_jobs set recipient_email=client.email,reply_to=(select reply_to from public.company_email_settings where company_id=j.company_id),
      sender=p_sender,subject=subject_text,body=body_text,company_name=company.name where id=j.id;
    select * into j from public.quote_followup_jobs where id=j.id;
  end if;
  return to_jsonb(j)||jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.prepare_quote_followup_send(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_quote_followup_send(uuid,uuid,text) to service_role;

create function public.persist_quote_followup_payload(p_job_id uuid,p_lease_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; reason text;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  reason:=public.quote_followup_block_reason(j.id);
  if reason is not null then raise exception 'Cet envoi a été arrêté.' using errcode='23514'; end if;
  if j.provider_payload is null then
    if not public.valid_followup_email(j.recipient_email) or not public.valid_followup_email(j.reply_to) or j.sender is null or j.subject is null or j.body is null
      or p_payload is null or jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>6
      or p_payload->>'from' is distinct from j.sender or p_payload->>'to' is distinct from j.recipient_email
      or p_payload->>'reply_to' is distinct from j.reply_to or p_payload->>'subject' is distinct from j.subject
      or p_payload->>'text' is distinct from j.body or jsonb_typeof(p_payload->'html') is distinct from 'string'
      or length(p_payload->>'html')>30000 then raise exception 'Contenu d’envoi invalide.' using errcode='22023'; end if;
    update public.quote_followup_jobs set provider_payload=p_payload,first_attempt_at=clock_timestamp() where id=j.id;
    select * into j from public.quote_followup_jobs where id=j.id;
  end if;
  if j.first_attempt_at<clock_timestamp()-interval '23 hours' then raise exception 'Fenêtre de reprise expirée.' using errcode='23514'; end if;
  return jsonb_build_object('payload',j.provider_payload,'first_attempt_at',j.first_attempt_at);
end;
$$;
revoke all on function public.persist_quote_followup_payload(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_quote_followup_payload(uuid,uuid,jsonb) to service_role;

create function public.record_quote_followup_provider_acceptance(p_job_id uuid,p_lease_token uuid,p_provider_message_id text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.lease_token is distinct from p_lease_token or j.status not in ('processing','sent') then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 200 or p_provider_message_id~E'[\r\n]' then raise exception 'Confirmation provider invalide.' using errcode='22023'; end if;
  if j.provider_payload is null or j.first_attempt_at is null then raise exception 'Aucune requête d’envoi préparée.' using errcode='23514'; end if;
  if j.provider_message_id is not null and j.provider_message_id<>p_provider_message_id then raise exception 'Confirmation provider différente.' using errcode='22023'; end if;
  update public.quote_followup_jobs set provider_message_id=p_provider_message_id,ambiguous=false where id=j.id;
end;
$$;
revoke all on function public.record_quote_followup_provider_acceptance(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_quote_followup_provider_acceptance(uuid,uuid,text) to service_role;

create function public.complete_quote_followup_job(p_job_id uuid,p_lease_token uuid,p_provider_message_id text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; a public.quote_followup_automations%rowtype;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.lease_token is distinct from p_lease_token then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if j.status='sent' and j.provider_message_id=p_provider_message_id then return; end if;
  if j.status<>'processing' then raise exception 'Cet envoi n’est pas réservé.' using errcode='23514'; end if;
  perform public.record_quote_followup_provider_acceptance(j.id,p_lease_token,p_provider_message_id);
  select * into a from public.quote_followup_automations where quote_id=j.quote_id for update;
  update public.quote_followup_jobs set status='sent',sent_at=clock_timestamp(),lease_until=null,last_error_code=null,updated_at=clock_timestamp() where id=j.id;
  update public.quote_followup_attempts set finished_at=clock_timestamp(),result='sent',error_code=null where job_id=j.id and attempt_number=j.attempts;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by,automation_job_id,delivery_status)
    values(j.company_id,j.quote_id,'followup_auto_sent',j.body,a.activated_by,j.id,'sent') on conflict(automation_job_id,event_type) where automation_job_id is not null do nothing;
  if a.activated_by is not null then
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,automation_job_id)
      values(j.company_id,a.activated_by,'quote_followup_sent','Relance automatique envoyée','L’envoi a été accepté par le service email.',j.quote_id,j.id)
      on conflict(user_id,automation_job_id,type) where automation_job_id is not null do nothing;
  end if;
  if j.step=2 then perform public.stop_quote_followup_automation(j.quote_id,'completed');
  elsif a.enabled then
    update public.quote_followup_jobs set scheduled_at=greatest(scheduled_at,((clock_timestamp() at time zone 'Europe/Paris')::date+(a.second_delay_days-a.first_delay_days)+time '09:00') at time zone 'Europe/Paris'),
      next_attempt_at=greatest(next_attempt_at,((clock_timestamp() at time zone 'Europe/Paris')::date+(a.second_delay_days-a.first_delay_days)+time '09:00') at time zone 'Europe/Paris')
      where quote_id=j.quote_id and generation=a.generation and step=2 and status='queued';
    update public.quote_followup_automations set next_send_at=(select min(greatest(scheduled_at,next_attempt_at)) from public.quote_followup_jobs where quote_id=j.quote_id and generation=a.generation and status='queued'),updated_at=clock_timestamp() where quote_id=j.quote_id;
  end if;
end;
$$;
revoke all on function public.complete_quote_followup_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_quote_followup_job(uuid,uuid,text) to service_role;

create function public.fail_quote_followup_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_ambiguous boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare j public.quote_followup_jobs%rowtype; uncertain boolean; retryable boolean; retry_at timestamptz;
begin
  perform public.lock_quote_followup_job(p_job_id);
  select * into j from public.quote_followup_jobs where id=p_job_id for update;
  if not found or j.lease_token is distinct from p_lease_token or j.status<>'processing' then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' or p_ambiguous is null then raise exception 'Code d’échec invalide.' using errcode='22023'; end if;
  uncertain:=j.ambiguous or p_ambiguous;
  retryable:=p_ambiguous or p_error_code in ('prepare_failed','provider_rate_limited','provider_concurrent_request');
  update public.quote_followup_jobs set ambiguous=uncertain,last_error_code=p_error_code where id=j.id;
  if j.provider_message_id is not null then
    update public.quote_followup_jobs set status='queued',next_attempt_at=clock_timestamp()+interval '1 minute',lease_until=null where id=j.id;
  elsif not retryable or j.attempts>=5 or p_error_code in ('idempotency_window_expired','provider_payload_mismatch')
    or (j.first_attempt_at is not null and j.first_attempt_at<clock_timestamp()-interval '23 hours') then
    perform public.finalize_quote_followup_failure(j.id,case when uncertain then 'delivery_unknown' else 'failed' end,p_error_code);
  else
    retry_at:=clock_timestamp()+make_interval(secs=>least(3600,60*(2^(j.attempts-1))::integer));
    update public.quote_followup_jobs set status='queued',next_attempt_at=retry_at,lease_until=null,updated_at=clock_timestamp() where id=j.id;
    update public.quote_followup_automations set next_send_at=retry_at where quote_id=j.quote_id and enabled;
    update public.quote_followup_attempts set finished_at=clock_timestamp(),result='retry',error_code=p_error_code where job_id=j.id and attempt_number=j.attempts;
  end if;
end;
$$;
revoke all on function public.fail_quote_followup_job(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.fail_quote_followup_job(uuid,uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
