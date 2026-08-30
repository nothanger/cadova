-- Quote follow-up workflow: planned actions and an auditable activity timeline.
alter table public.quotes
  add column if not exists next_followup_at date,
  add column if not exists expires_at date;

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (event_type in (
    'sent', 'followup', 'response', 'note', 'status_change', 'followup_scheduled'
  )),
  content text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists quote_events_quote_idx
  on public.quote_events (quote_id, occurred_at desc);
create index if not exists quotes_next_followup_idx
  on public.quotes (company_id, next_followup_at)
  where status = 'sent';

alter table public.quote_events enable row level security;

drop policy if exists quote_events_select on public.quote_events;
create policy quote_events_select on public.quote_events
  for select using (public.is_company_member(company_id));
drop policy if exists quote_events_insert on public.quote_events;
create policy quote_events_insert on public.quote_events
  for insert with check (
    public.is_company_member(company_id)
    and (created_by is null or created_by = auth.uid())
  );
drop policy if exists quote_events_update on public.quote_events;
create policy quote_events_update on public.quote_events
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
drop policy if exists quote_events_delete on public.quote_events;
create policy quote_events_delete on public.quote_events
  for delete using (public.is_company_member(company_id));

grant select, insert, update, delete on public.quote_events to authenticated;
notify pgrst, 'reload schema';
