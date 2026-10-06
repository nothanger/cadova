-- Company tools: fulfilment tracking, reusable messages and scoped search.
-- Commercial quote statuses and frozen email jobs remain unchanged.

create table public.quote_work_orders (
  quote_id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null check(status in ('to_schedule','scheduled','in_progress','completed')),
  scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_work_orders_same_company_fkey foreign key(company_id,quote_id)
    references public.quotes(company_id,id) on delete cascade,
  constraint quote_work_orders_schedule_check check(
    (status<>'scheduled' or scheduled_for is not null)
    and (status<>'to_schedule' or scheduled_for is null)
    and (scheduled_for is null or scheduled_for between date '1900-01-01' and date '2200-12-31')
  )
);
create index quote_work_orders_company_schedule_idx
  on public.quote_work_orders(company_id,status,scheduled_for);

create function public.validate_quote_work_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype;
begin
  select * into q from public.quotes where id=new.quote_id for update;
  if not found or q.company_id<>new.company_id then
    raise exception 'Le devis et l’intervention doivent appartenir à la même entreprise.' using errcode='23514';
  end if;
  if q.status<>'accepted' then
    raise exception 'Le devis doit être accepté avant de suivre l’intervention.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and (new.quote_id<>old.quote_id or new.company_id<>old.company_id) then
    raise exception 'L’intervention ne peut pas changer de devis ou d’entreprise.' using errcode='23514';
  end if;
  if tg_op='UPDATE' then new.updated_at:=clock_timestamp(); end if;
  return new;
end;
$$;
revoke all on function public.validate_quote_work_order() from public,anon,authenticated,service_role;
create trigger quote_work_orders_validate before insert or update on public.quote_work_orders
  for each row execute function public.validate_quote_work_order();
create trigger quote_work_orders_set_updated_at before update on public.quote_work_orders
  for each row execute function public.set_updated_at();
alter table public.quote_work_orders enable row level security;
create policy quote_work_orders_select on public.quote_work_orders for select to authenticated
  using(public.is_company_member(company_id));
revoke all on public.quote_work_orders from public,anon,authenticated,service_role;
grant select on public.quote_work_orders to authenticated;
grant select,insert,update,delete on public.quote_work_orders to service_role;

alter table public.quote_events add column work_order_status text;
alter table public.quote_events add column work_order_scheduled_for date;
alter table public.quote_events drop constraint quote_events_event_type_check;
alter table public.quote_events add constraint quote_events_event_type_check check(event_type in (
  'sent','followup','response','note','status_change','followup_scheduled','followup_auto_sent','followup_auto_failed','work_order_change'
));
alter table public.quote_events add constraint quote_events_work_order_fields_check check(
  (event_type='work_order_change' and work_order_status is not null
    and work_order_status in ('to_schedule','scheduled','in_progress','completed')
    and (work_order_status<>'scheduled' or work_order_scheduled_for is not null)
    and (work_order_status<>'to_schedule' or work_order_scheduled_for is null)
    and (work_order_scheduled_for is null or work_order_scheduled_for between date '1900-01-01' and date '2200-12-31'))
  or (event_type<>'work_order_change' and work_order_status is null and work_order_scheduled_for is null)
);

-- Browser-written notes cannot fabricate or remove fulfilment history, just as
-- provider and portal facts are protected by the preceding migrations.
drop policy quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events for insert to authenticated with check(
  public.is_company_member(company_id) and (created_by is null or created_by=auth.uid())
  and event_type not in ('followup_auto_sent','followup_auto_failed','work_order_change')
  and automation_job_id is null and initial_send_job_id is null and delivery_status is null
  and portal_message_id is null and email_delivery_id is null and email_reply_id is null
  and work_order_status is null and work_order_scheduled_for is null
);
drop policy quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events for update to authenticated
  using(public.is_company_member(company_id) and event_type not in ('followup_auto_sent','followup_auto_failed','work_order_change')
    and automation_job_id is null and initial_send_job_id is null and delivery_status is null
    and portal_message_id is null and email_delivery_id is null and email_reply_id is null)
  with check(public.is_company_member(company_id) and event_type not in ('followup_auto_sent','followup_auto_failed','work_order_change')
    and automation_job_id is null and initial_send_job_id is null and delivery_status is null
    and portal_message_id is null and email_delivery_id is null and email_reply_id is null
    and work_order_status is null and work_order_scheduled_for is null);
drop policy quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events for delete to authenticated
  using(public.is_company_member(company_id) and event_type not in ('followup_auto_sent','followup_auto_failed','work_order_change')
    and automation_job_id is null and initial_send_job_id is null and delivery_status is null
    and portal_message_id is null and email_delivery_id is null and email_reply_id is null);

create function public.save_quote_work_order(p_quote_id uuid,p_status text,p_scheduled_for date default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; w public.quote_work_orders%rowtype; content_text text;
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'Votre compte ne permet pas cette action.' using errcode='42501';
  end if;
  if p_quote_id is null or p_status is null or p_status not in ('to_schedule','scheduled','in_progress','completed')
    or (p_status='scheduled' and p_scheduled_for is null)
    or (p_status='to_schedule' and p_scheduled_for is not null)
    or (p_scheduled_for is not null and p_scheduled_for not between date '1900-01-01' and date '2200-12-31') then
    raise exception 'Vérifiez l’état et la date de l’intervention.' using errcode='22023';
  end if;
  -- The quote lock serializes duplicate saves and commercial status changes.
  select * into q from public.quotes where id=p_quote_id and public.is_company_member(company_id) for update;
  if not found then raise exception 'Ce devis est inaccessible.' using errcode='42501'; end if;
  if q.status<>'accepted' then
    raise exception 'Le devis doit être accepté avant de suivre l’intervention.' using errcode='23514';
  end if;
  select * into w from public.quote_work_orders where quote_id=q.id for update;
  if found and w.status=p_status and w.scheduled_for is not distinct from p_scheduled_for then
    return to_jsonb(w);
  end if;
  if (w.quote_id is not null and (p_expected_updated_at is null or w.updated_at<>p_expected_updated_at))
    or (w.quote_id is null and p_expected_updated_at is not null) then
    raise exception 'L’intervention a changé depuis son ouverture. Rechargez son état avant de continuer.' using errcode='40001';
  end if;
  insert into public.quote_work_orders(quote_id,company_id,status,scheduled_for)
    values(q.id,q.company_id,p_status,p_scheduled_for)
    on conflict(quote_id) do update set status=excluded.status,scheduled_for=excluded.scheduled_for
    returning * into w;
  content_text:=case p_status when 'to_schedule' then 'Intervention à planifier.'
    when 'scheduled' then 'Intervention prévue le '||to_char(p_scheduled_for,'DD/MM/YYYY')||'.'
    when 'in_progress' then 'Intervention en cours.' when 'completed' then 'Intervention terminée.' end;
  insert into public.quote_events(company_id,quote_id,event_type,content,created_by,work_order_status,work_order_scheduled_for)
    values(q.company_id,q.id,'work_order_change',content_text,auth.uid(),p_status,p_scheduled_for);
  return to_jsonb(w);
end;
$$;
revoke all on function public.save_quote_work_order(uuid,text,date,timestamptz) from public,anon,service_role;
grant execute on function public.save_quote_work_order(uuid,text,date,timestamptz) to authenticated;

create function public.company_message_template_valid(p_subject text,p_body text) returns boolean
language sql immutable set search_path='' as $$
  select p_subject is not null and p_body is not null
    and length(btrim(p_subject)) between 1 and 160 and p_subject !~ E'[\r\n]'
    and length(btrim(p_body)) between 1 and 4000
    and regexp_replace(p_subject||p_body,'\{\{(client_name|quote_reference|company_name|amount_formatted)\}\}','','g') !~ '[{}]';
$$;
revoke all on function public.company_message_template_valid(text,text) from public,anon,authenticated,service_role;
grant execute on function public.company_message_template_valid(text,text) to service_role;

create table public.company_message_templates (
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check(kind in ('quote_send','first_followup','second_followup','expiry_followup','automatic_followup')),
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id,kind),
  constraint company_message_templates_content_check check(public.company_message_template_valid(subject_template,body_template))
);
create table public.company_message_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  email_signature text not null default '' check(length(email_signature)<=800 and email_signature !~ '[{}]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger company_message_templates_set_updated_at before update on public.company_message_templates
  for each row execute function public.set_updated_at();
create trigger company_message_profiles_set_updated_at before update on public.company_message_profiles
  for each row execute function public.set_updated_at();
alter table public.company_message_templates enable row level security;
alter table public.company_message_profiles enable row level security;
create policy company_message_templates_select on public.company_message_templates for select to authenticated
  using(public.is_company_member(company_id));
create policy company_message_profiles_select on public.company_message_profiles for select to authenticated
  using(public.is_company_member(company_id));
revoke all on public.company_message_templates,public.company_message_profiles from public,anon,authenticated,service_role;
grant select on public.company_message_templates,public.company_message_profiles to authenticated;
grant select,insert,update,delete on public.company_message_templates,public.company_message_profiles to service_role;

create function public.save_company_message_template(p_company_id uuid,p_kind text,p_subject_template text,p_body_template text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare subject_text text; body_text text; saved public.company_message_templates%rowtype;
begin
  if auth.uid() is null or p_company_id is null or not public.is_company_owner(p_company_id) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier ses modèles.' using errcode='42501';
  end if;
  perform 1 from public.companies where id=p_company_id for key share;
  if not found then raise exception 'Cette entreprise est inaccessible.' using errcode='42501'; end if;
  subject_text:=regexp_replace(btrim(p_subject_template),'\{\{\s*(client_name|quote_reference|company_name|amount_formatted)\s*\}\}','{{\1}}','g');
  body_text:=regexp_replace(btrim(p_body_template),'\{\{\s*(client_name|quote_reference|company_name|amount_formatted)\s*\}\}','{{\1}}','g');
  if p_kind is null or p_kind not in ('quote_send','first_followup','second_followup','expiry_followup','automatic_followup')
    or not public.company_message_template_valid(subject_text,body_text) then
    raise exception 'Vérifiez le modèle : objet de 160 caractères, message de 4 000 caractères et variables autorisées.' using errcode='22023';
  end if;
  insert into public.company_message_templates(company_id,kind,subject_template,body_template)
    values(p_company_id,p_kind,subject_text,body_text)
    on conflict(company_id,kind) do update set subject_template=excluded.subject_template,body_template=excluded.body_template
    returning * into saved;
  return to_jsonb(saved);
end;
$$;
create function public.delete_company_message_template(p_company_id uuid,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_company_id is null or not public.is_company_owner(p_company_id) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier ses modèles.' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('quote_send','first_followup','second_followup','expiry_followup','automatic_followup') then
    raise exception 'Ce type de modèle est inconnu.' using errcode='22023';
  end if;
  delete from public.company_message_templates where company_id=p_company_id and kind=p_kind;
end;
$$;
create function public.save_company_message_profile(p_company_id uuid,p_email_signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare signature_text text:=btrim(p_email_signature); saved public.company_message_profiles%rowtype;
begin
  if auth.uid() is null or p_company_id is null or not public.is_company_owner(p_company_id) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier sa signature.' using errcode='42501';
  end if;
  perform 1 from public.companies where id=p_company_id for key share;
  if not found then raise exception 'Cette entreprise est inaccessible.' using errcode='42501'; end if;
  if signature_text is null or length(signature_text)>800 or signature_text ~ '[{}]' then
    raise exception 'La signature doit contenir au plus 800 caractères, sans variable.' using errcode='22023';
  end if;
  insert into public.company_message_profiles(company_id,email_signature) values(p_company_id,signature_text)
    on conflict(company_id) do update set email_signature=excluded.email_signature returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_company_message_template(uuid,text,text,text) from public,anon,service_role;
revoke all on function public.delete_company_message_template(uuid,text) from public,anon,service_role;
revoke all on function public.save_company_message_profile(uuid,text) from public,anon,service_role;
grant execute on function public.save_company_message_template(uuid,text,text,text),
  public.delete_company_message_template(uuid,text),public.save_company_message_profile(uuid,text) to authenticated;

-- Avoid a dependency on a locale-specific extension. Text matches are literal
-- (strpos), so '%' and '_' in a search never expand the caller's query.
create function public.company_search_text(p_text text) returns text
language sql immutable set search_path='' as $$
  select translate(replace(replace(lower(coalesce(p_text,'')),'œ','oe'),'æ','ae'),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ','aaaaaaceeeeiiiinooooouuuuyy');
$$;
create function public.company_search_phone(p_text text) returns text
language sql immutable set search_path='' as $$
  select case when digits like '0033%' then '0'||substr(digits,5)
    when digits like '33%' and (length(digits)=11 or btrim(coalesce(p_text,'')) like '+33%')
      then '0'||substr(digits,3) else digits end
  from (select regexp_replace(coalesce(p_text,''),'[^0-9]','','g') digits) normalized;
$$;
revoke all on function public.company_search_text(text),public.company_search_phone(text) from public,anon,authenticated,service_role;

create function public.search_company_records(p_company_id uuid,p_query text,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare query_text text:=btrim(p_query); normalized_query text; phone_query text; amount_query bigint;
  amount_text text; selected_items jsonb; more boolean;
begin
  if auth.uid() is null or p_company_id is null or not public.is_company_member(p_company_id)
    or not exists(select 1 from public.companies where id=p_company_id) then
    raise exception 'Cette entreprise est inaccessible.' using errcode='42501';
  end if;
  if query_text is null or length(query_text) not between 2 and 120 or query_text ~ '[[:cntrl:]]'
    or p_limit is null or p_limit not between 1 and 40 then
    raise exception 'Saisissez entre 2 et 120 caractères.' using errcode='22023';
  end if;
  normalized_query:=public.company_search_text(query_text);
  if query_text ~ '^[+0-9 ()/.–-]+$' then phone_query:=public.company_search_phone(query_text); end if;
  -- French grouping separators and an optional euro sign are accepted. One
  -- decimal separator is interpreted as euros; cents are never rounded.
  amount_text:=regexp_replace(replace(replace(query_text,chr(160),''),chr(8239),''),'[ €]','','g');
  if amount_text ~ '^[0-9]{1,16}([,.][0-9]{1,2})?$' then
    begin amount_query:=(replace(amount_text,',','.')::numeric*100)::bigint;
    exception when numeric_value_out_of_range or invalid_text_representation then amount_query:=null; end;
  end if;
  if amount_query is not null and amount_text ~ '[,.]' then phone_query:=null; end if;
  with matches as (
    select 'client'::text kind,c.id,c.company_id,c.name label,
      coalesce(nullif(c.email,''),nullif(c.phone,'')) detail,c.name client_name,
      null::bigint amount_cents,null::text status,
      case when public.company_search_text(c.name)=normalized_query then 0 else 1 end rank
    from public.clients c where c.company_id=p_company_id and (
      strpos(public.company_search_text(c.name),normalized_query)>0
      or strpos(public.company_search_text(c.email),normalized_query)>0
      or (length(phone_query)>=2 and strpos(public.company_search_phone(c.phone),phone_query)>0)
    )
    union all
    select 'quote'::text,q.id,q.company_id,q.reference,
      c.name||' · '||replace(to_char(q.amount_cents::numeric/100,'FM999999999999999990.00'),'.',',')||' €',
      c.name,q.amount_cents,q.status,
      case when public.company_search_text(q.reference)=normalized_query or q.amount_cents=amount_query then 0 else 1 end
    from public.quotes q join public.clients c on c.company_id=q.company_id and c.id=q.client_id
    where q.company_id=p_company_id and (
      strpos(public.company_search_text(q.reference),normalized_query)>0
      or strpos(public.company_search_text(c.name),normalized_query)>0
      or strpos(public.company_search_text(c.email),normalized_query)>0
      or (length(phone_query)>=2 and strpos(public.company_search_phone(c.phone),phone_query)>0)
      or q.amount_cents=amount_query
    )
  ), bounded as (
    select *,row_number() over(order by rank,public.company_search_text(label),kind,id) position
    from matches order by rank,public.company_search_text(label),kind,id limit p_limit+1
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'company_id',company_id,'label',label,
    'detail',detail,'client_name',client_name,'amount_cents',amount_cents,'status',status) order by position)
    filter(where position<=p_limit),'[]'::jsonb),count(*)>p_limit into selected_items,more from bounded;
  return jsonb_build_object('items',selected_items,'hasMore',more);
end;
$$;
revoke all on function public.search_company_records(uuid,text,integer) from public,anon,service_role;
grant execute on function public.search_company_records(uuid,text,integer) to authenticated;

notify pgrst,'reload schema';
