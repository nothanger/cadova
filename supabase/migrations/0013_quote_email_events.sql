-- Provider acceptance, delivery and a customer's response are distinct facts.
-- Only a signed provider webhook may populate these service-owned records.
create table public.quote_email_tracking_service_state (
  id boolean primary key default true check(id),
  delivery_ready boolean not null default false,
  receiving_ready boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check(not receiving_ready or delivery_ready)
);
insert into public.quote_email_tracking_service_state(id) values(true);
alter table public.quote_email_tracking_service_state enable row level security;
revoke all on public.quote_email_tracking_service_state from public,anon,authenticated,service_role;

create function public.set_quote_email_tracking_status(p_delivery_ready boolean,p_receiving_ready boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_delivery_ready is null or p_receiving_ready is null or (p_receiving_ready and not p_delivery_ready) then raise exception 'État invalide.' using errcode='22023'; end if;
  update public.quote_email_tracking_service_state set delivery_ready=p_delivery_ready,receiving_ready=p_receiving_ready,updated_at=clock_timestamp() where id;
end;
$$;
revoke all on function public.set_quote_email_tracking_status(boolean,boolean) from public,anon,authenticated;
grant execute on function public.set_quote_email_tracking_status(boolean,boolean) to service_role;

create function public.read_quote_email_tracking_status() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.current_user_is_active() then raise exception 'Compte actif requis.' using errcode='42501'; end if;
  return(select jsonb_build_object('deliveryReady',delivery_ready,'receivingReady',receiving_ready,
    'code',case when receiving_ready then 'ready' when delivery_ready then 'delivery_only' else 'unconfigured' end)
    from public.quote_email_tracking_service_state where id);
end;
$$;
revoke all on function public.read_quote_email_tracking_status() from public,anon;
grant execute on function public.read_quote_email_tracking_status() to authenticated;

create table public.quote_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  initial_send_job_id uuid unique references public.quote_initial_send_jobs(id) on delete cascade,
  automation_job_id uuid unique references public.quote_followup_jobs(id) on delete cascade,
  provider_message_id text not null unique check(provider_message_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  status text not null default 'accepted' check(status in ('accepted','delayed','delivered','bounced','failed','complained')),
  last_event_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade,
  check((initial_send_job_id is not null)::integer+(automation_job_id is not null)::integer=1)
);
create index quote_email_deliveries_quote_idx on public.quote_email_deliveries(quote_id,created_at desc);
alter table public.quote_email_deliveries enable row level security;
revoke all on public.quote_email_deliveries from public,anon,authenticated,service_role;
grant select on public.quote_email_deliveries to authenticated,service_role;
create policy quote_email_deliveries_select on public.quote_email_deliveries for select to authenticated using(public.is_company_member(company_id));

create table public.quote_email_provider_events (
  event_id text primary key check(event_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  email_delivery_id uuid references public.quote_email_deliveries(id) on delete cascade,
  received_email_id text unique,
  received_at timestamptz not null default clock_timestamp()
);
alter table public.quote_email_provider_events enable row level security;
revoke all on public.quote_email_provider_events from public,anon,authenticated,service_role;

-- Opaque random addresses never expose company IDs, quote IDs or sequential IDs.
-- They are private routing data, not a browser-readable customer directory.
create table public.quote_email_reply_routes (
  quote_id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  local_part text not null unique check(local_part ~ '^q-[a-f0-9]{48}$'),
  domain text not null check(length(domain)<=253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade
);
alter table public.quote_email_reply_routes enable row level security;
revoke all on public.quote_email_reply_routes from public,anon,authenticated,service_role;

create function public.ensure_quote_send_reply_address(p_kind text,p_job_id uuid,p_lease_token uuid,p_domain text) returns text
language plpgsql security definer set search_path='' as $$
declare target uuid; tenant uuid; route public.quote_email_reply_routes%rowtype;
begin
  if p_domain is null or length(p_domain)>253 or p_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then raise exception 'Domaine de réception invalide.' using errcode='22023'; end if;
  if not exists(select 1 from public.quote_email_tracking_service_state where id and delivery_ready and receiving_ready) then return null; end if;
  if p_kind='initial' then select quote_id into target from public.quote_initial_send_jobs where id=p_job_id;
  elsif p_kind='followup' then select quote_id into target from public.quote_followup_jobs where id=p_job_id;
  else raise exception 'Type invalide.' using errcode='22023'; end if;
  select company_id into tenant from public.quotes where id=target for update;
  if not found then raise exception 'Devis introuvable.' using errcode='P0002'; end if;
  if p_kind='initial' then
    perform 1 from public.quote_initial_send_jobs where id=p_job_id and company_id=tenant and quote_id=target and status='processing' and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  else
    perform 1 from public.quote_followup_jobs where id=p_job_id and company_id=tenant and quote_id=target and status='processing' and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  end if;
  if not found then raise exception 'Réservation expirée.' using errcode='23514'; end if;
  insert into public.quote_email_reply_routes(quote_id,company_id,local_part,domain)
    values(target,tenant,'q-'||replace(gen_random_uuid()::text,'-','')||left(replace(gen_random_uuid()::text,'-',''),16),p_domain) on conflict(quote_id) do nothing;
  select * into route from public.quote_email_reply_routes where quote_id=target;
  if route.company_id<>tenant or route.domain<>p_domain then raise exception 'Domaine de réponse modifié.' using errcode='23514'; end if;
  return route.local_part||'@'||route.domain;
end;
$$;
revoke all on function public.ensure_quote_send_reply_address(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ensure_quote_send_reply_address(text,uuid,uuid,text) to service_role;

create function public.register_quote_email_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
declare initial_id uuid; followup_id uuid;
begin
  if new.provider_message_id is null then return new; end if;
  if tg_table_name='quote_initial_send_jobs' then initial_id:=new.id; else followup_id:=new.id; end if;
  insert into public.quote_email_deliveries(company_id,quote_id,initial_send_job_id,automation_job_id,provider_message_id,last_event_at,created_at)
    values(new.company_id,new.quote_id,initial_id,followup_id,new.provider_message_id,coalesce(new.sent_at,clock_timestamp()),coalesce(new.first_attempt_at,new.created_at));
  return new;
exception when unique_violation then
  if not exists(select 1 from public.quote_email_deliveries where provider_message_id=new.provider_message_id and company_id=new.company_id and quote_id=new.quote_id
    and initial_send_job_id is not distinct from initial_id and automation_job_id is not distinct from followup_id) then raise; end if;
  return new;
end;
$$;
revoke all on function public.register_quote_email_acceptance() from public,anon,authenticated,service_role;
create trigger quote_initial_register_email after insert or update of provider_message_id on public.quote_initial_send_jobs for each row execute function public.register_quote_email_acceptance();
create trigger quote_followup_register_email after insert or update of provider_message_id on public.quote_followup_jobs for each row execute function public.register_quote_email_acceptance();
insert into public.quote_email_deliveries(company_id,quote_id,initial_send_job_id,provider_message_id,last_event_at,created_at)
  select company_id,quote_id,id,provider_message_id,coalesce(sent_at,updated_at),coalesce(first_attempt_at,created_at) from public.quote_initial_send_jobs where provider_message_id is not null;
insert into public.quote_email_deliveries(company_id,quote_id,automation_job_id,provider_message_id,last_event_at,created_at)
  select company_id,quote_id,id,provider_message_id,coalesce(sent_at,updated_at),coalesce(first_attempt_at,created_at) from public.quote_followup_jobs where provider_message_id is not null;

create table public.quote_email_replies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  received_email_id text not null unique check(received_email_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  sender_email text not null check(public.valid_followup_email(sender_email)),
  content text not null check(length(content) between 1 and 4000),
  received_at timestamptz not null,
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade
);
alter table public.quote_email_replies enable row level security;
revoke all on public.quote_email_replies from public,anon,authenticated,service_role;
grant select on public.quote_email_replies to authenticated;
create policy quote_email_replies_select on public.quote_email_replies for select to authenticated using(public.is_company_member(company_id));

alter table public.quote_events add column email_delivery_id uuid references public.quote_email_deliveries(id) on delete cascade;
alter table public.quote_events add column email_reply_id uuid unique references public.quote_email_replies(id) on delete cascade;
create unique index quote_events_delivery_once on public.quote_events(email_delivery_id,content) where email_delivery_id is not null;
alter table public.notifications add column email_delivery_id uuid references public.quote_email_deliveries(id) on delete cascade;
alter table public.notifications add column email_reply_id uuid references public.quote_email_replies(id) on delete cascade;
create unique index notifications_email_delivery_once on public.notifications(user_id,email_delivery_id,title) where email_delivery_id is not null;
create unique index notifications_email_reply_once on public.notifications(user_id,email_reply_id) where email_reply_id is not null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in (
  'quote_followup_due','daily_followup_summary','support_message','admin_message','admin_announcement','quote_followup_sent','quote_followup_failed','quote_sent','quote_send_failed','quote_client_message','quote_email_delivery','quote_email_response'
));

-- Protected service facts remain immutable even to a company member.
drop policy quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events for insert to authenticated with check(
  public.is_company_member(company_id) and (created_by is null or created_by=auth.uid())
  and event_type not in ('followup_auto_sent','followup_auto_failed') and automation_job_id is null and initial_send_job_id is null and delivery_status is null
  and portal_message_id is null and email_delivery_id is null and email_reply_id is null
);
drop policy quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events for update to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed') and portal_message_id is null and email_delivery_id is null and email_reply_id is null)
  with check(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed') and portal_message_id is null and email_delivery_id is null and email_reply_id is null);
drop policy quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events for delete to authenticated
  using(public.is_company_member(company_id) and automation_job_id is null and initial_send_job_id is null and delivery_status is null and event_type not in ('followup_auto_sent','followup_auto_failed') and portal_message_id is null and email_delivery_id is null and email_reply_id is null);

create function public.quote_email_delivery_rank(p_status text) returns integer language sql immutable set search_path='' as $$
  select case p_status when 'accepted' then 0 when 'delayed' then 1 when 'delivered' then 2 when 'failed' then 3 when 'bounced' then 4 when 'complained' then 5 else -1 end;
$$;
revoke all on function public.quote_email_delivery_rank(text) from public,anon,authenticated;

create function public.process_quote_email_delivery(p_event_id text,p_provider_message_id text,p_status text,p_occurred_at timestamptz) returns text
language plpgsql security definer set search_path='' as $$
declare d public.quote_email_deliveries%rowtype; target uuid; title_text text; content_text text; member_id uuid;
begin
  if p_event_id is null or p_event_id !~ '^[A-Za-z0-9_-]{1,200}$' or p_provider_message_id is null or p_provider_message_id !~ '^[A-Za-z0-9_-]{1,200}$'
    or public.quote_email_delivery_rank(p_status)<0 or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval '5 minutes' then raise exception 'Événement invalide.' using errcode='22023'; end if;
  if exists(select 1 from public.quote_email_provider_events where event_id=p_event_id) then return 'duplicate'; end if;
  select quote_id into target from public.quote_email_deliveries where provider_message_id=p_provider_message_id;
  if target is null then return 'unmatched'; end if;
  perform 1 from public.quotes where id=target for update;
  select * into d from public.quote_email_deliveries where provider_message_id=p_provider_message_id for update;
  if not found then return 'unmatched'; end if;
  insert into public.quote_email_provider_events(event_id,email_delivery_id) values(p_event_id,d.id) on conflict(event_id) do nothing;
  if not found then return 'duplicate'; end if;
  if public.quote_email_delivery_rank(p_status)<=public.quote_email_delivery_rank(d.status) then return 'applied'; end if;
  update public.quote_email_deliveries set status=p_status,last_event_at=greatest(last_event_at,p_occurred_at) where id=d.id;
  if p_status='accepted' then return 'applied'; end if;
  title_text:=case p_status when 'delayed' then 'Livraison retardée' when 'delivered' then 'Email livré' when 'bounced' then 'Email non livré' when 'failed' then 'Échec de livraison' else 'Email signalé comme indésirable' end;
  content_text:=case p_status when 'delayed' then 'Le serveur du destinataire retarde la livraison de cet email.' when 'delivered' then 'Le serveur du destinataire a accepté cet email. Sa lecture n’est pas confirmée.' when 'bounced' then 'Le serveur du destinataire a refusé cet email. Vérifiez son adresse avant un nouvel envoi.' when 'failed' then 'Le service d’envoi n’a pas pu livrer cet email.' else 'Cet email a été signalé comme indésirable. Les relances automatiques sont arrêtées.' end;
  insert into public.quote_events(company_id,quote_id,event_type,content,email_delivery_id) values(d.company_id,d.quote_id,'note',content_text,d.id)
    on conflict(email_delivery_id,content) where email_delivery_id is not null do nothing;
  if p_status in ('bounced','failed','complained') then perform public.stop_quote_followup_automation(d.quote_id,case when p_status='complained' then 'email_complained' else 'delivery_failed' end); end if;
  for member_id in select m.user_id from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=d.company_id and (u.banned_until is null or u.banned_until<=now()) loop
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,email_delivery_id)
      values(d.company_id,member_id,'quote_email_delivery',title_text,content_text,d.quote_id,d.id) on conflict(user_id,email_delivery_id,title) where email_delivery_id is not null do nothing;
  end loop;
  return 'applied';
end;
$$;
revoke all on function public.process_quote_email_delivery(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.process_quote_email_delivery(text,text,text,timestamptz) to service_role;

create function public.record_quote_email_reply(p_event_id text,p_received_email_id text,p_recipient text,p_from text,p_content text,p_occurred_at timestamptz,p_headers jsonb default '{}'::jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare route public.quote_email_reply_routes%rowtype; reply_id uuid; member_id uuid; sender_address text:=lower(btrim(p_from));
begin
  if p_event_id is null or p_event_id !~ '^[A-Za-z0-9_-]{1,200}$' or p_received_email_id is null or p_received_email_id !~ '^[A-Za-z0-9_-]{1,200}$'
    or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval '5 minutes' or not public.valid_followup_email(sender_address)
    or p_content is null or length(btrim(p_content)) not between 1 and 4000 or p_content ~ '[[:cntrl:]]' and p_content ~ E'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'
    or p_headers is null or jsonb_typeof(p_headers)<>'object' or octet_length(p_headers::text)>8192 then raise exception 'Réponse invalide.' using errcode='22023'; end if;
  if exists(select 1 from public.quote_email_provider_events where event_id=p_event_id or received_email_id=p_received_email_id) then return 'duplicate'; end if;
  if not exists(select 1 from public.quote_email_tracking_service_state where id and receiving_ready) then raise exception 'Réception indisponible.' using errcode='55000'; end if;
  select * into route from public.quote_email_reply_routes where local_part||'@'||domain=lower(p_recipient);
  if not found then return 'ignored'; end if;
  perform 1 from public.quotes where id=route.quote_id and company_id=route.company_id for update;
  if not found then return 'ignored'; end if;
  -- Both the opaque destination and a known customer address must agree. The
  -- subject, a UUID supplied in content, and arbitrary HTML never select a quote.
  if not (exists(select 1 from public.quote_initial_send_jobs where quote_id=route.quote_id and company_id=route.company_id and provider_message_id is not null and lower(recipient_email)=sender_address)
    or exists(select 1 from public.quote_followup_jobs where quote_id=route.quote_id and company_id=route.company_id and provider_message_id is not null and lower(recipient_email)=sender_address)) then return 'ignored'; end if;
  insert into public.quote_email_provider_events(event_id,received_email_id) values(p_event_id,p_received_email_id) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  insert into public.quote_email_replies(company_id,quote_id,received_email_id,sender_email,content,received_at)
    values(route.company_id,route.quote_id,p_received_email_id,sender_address,btrim(p_content),p_occurred_at) returning id into reply_id;
  -- Plain customer text joins the same conversation as portal questions;
  -- provider headers, sender addresses and attachments never enter that view.
  insert into public.quote_client_messages(company_id,quote_id,author,kind,content,nonce,created_at)
    values(route.company_id,route.quote_id,'client','question',left(btrim(p_content),2000),reply_id,p_occurred_at);
  -- This insertion invokes quote_followups_stop_on_response in the same commit.
  insert into public.quote_events(company_id,quote_id,event_type,content,email_reply_id) values(route.company_id,route.quote_id,'response',btrim(p_content),reply_id);
  for member_id in select m.user_id from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=route.company_id and (u.banned_until is null or u.banned_until<=now()) loop
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id,email_reply_id)
      values(route.company_id,member_id,'quote_email_response','Réponse du client','Une réponse à votre email est disponible dans le dossier du devis.',route.quote_id,reply_id)
      on conflict(user_id,email_reply_id) where email_reply_id is not null do nothing;
  end loop;
  return 'applied';
end;
$$;
revoke all on function public.record_quote_email_reply(text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.record_quote_email_reply(text,text,text,text,text,timestamptz,jsonb) to service_role;
