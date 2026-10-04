-- pg_net may retain request headers. Scheduled requests therefore carry only
-- a short-lived HMAC proof; the permanent signing secret stays in Vault/Edge.
-- The worker verifies the signature before consuming this nonce atomically.
create table public.quote_followup_scheduler_nonces (
  nonce uuid primary key,
  issued_at bigint not null,
  consumed_at timestamptz not null default clock_timestamp()
);
create index quote_followup_scheduler_nonces_expiry_idx
  on public.quote_followup_scheduler_nonces(issued_at);
alter table public.quote_followup_scheduler_nonces enable row level security;
revoke all on public.quote_followup_scheduler_nonces
  from public, anon, authenticated, service_role;

create function public.consume_quote_followup_scheduler_nonce(
  p_nonce uuid, p_issued_at bigint
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  inserted_rows integer;
begin
  if p_nonce is null or p_issued_at is null
    or p_issued_at < current_epoch - 300
    or p_issued_at > current_epoch + 30 then
    return false;
  end if;

  -- Keep a ten-minute replay record for clock drift. An expired proof cannot
  -- become valid again after cleanup: its signed timestamp is checked above.
  delete from public.quote_followup_scheduler_nonces
    where issued_at < current_epoch - 600;
  insert into public.quote_followup_scheduler_nonces(nonce, issued_at)
    values (p_nonce, p_issued_at)
    on conflict (nonce) do nothing;
  get diagnostics inserted_rows = row_count;
  return inserted_rows = 1;
end;
$$;
revoke all on function public.consume_quote_followup_scheduler_nonce(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.consume_quote_followup_scheduler_nonce(uuid, bigint)
  to service_role;

notify pgrst, 'reload schema';
