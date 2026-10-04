-- Local isolated PostgreSQL only. No scheduler or HTTP request is made.
begin;
set local role authenticated;
do $$ begin
  begin
    perform public.consume_quote_followup_scheduler_nonce(gen_random_uuid(), extract(epoch from clock_timestamp())::bigint);
    raise exception 'Authenticated user consumed scheduler proof';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.quote_followup_scheduler_nonces;
    raise exception 'Authenticated user read scheduler nonces';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.consume_quote_followup_scheduler_nonce(gen_random_uuid(), extract(epoch from clock_timestamp())::bigint);
    raise exception 'Anonymous user consumed scheduler proof';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.quote_followup_scheduler_nonces(nonce,issued_at) values
  ('da000000-0000-4000-8000-000000000001',floor(extract(epoch from clock_timestamp()))::bigint-1000),
  ('da000000-0000-4000-8000-000000000002',floor(extract(epoch from clock_timestamp()))::bigint);
set local role service_role;
do $$
declare epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
begin
  if public.consume_quote_followup_scheduler_nonce(null,epoch)
    or public.consume_quote_followup_scheduler_nonce(gen_random_uuid(),null)
    or public.consume_quote_followup_scheduler_nonce(gen_random_uuid(),epoch-301)
    or public.consume_quote_followup_scheduler_nonce(gen_random_uuid(),epoch+60)
    or public.consume_quote_followup_scheduler_nonce(gen_random_uuid(),'-9223372036854775808'::bigint)
    or public.consume_quote_followup_scheduler_nonce(gen_random_uuid(),'9223372036854775807'::bigint) then
    raise exception 'Scheduler proof window allowed invalid timestamp';
  end if;
  if not public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000003',epoch-299)
    or not public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000004',epoch+30)
    or not public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000005',epoch) then
    raise exception 'Valid scheduler proof was rejected';
  end if;
  if public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000005',epoch)
    or public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000005',epoch+1)
    or public.consume_quote_followup_scheduler_nonce('da000000-0000-4000-8000-000000000002',epoch) then
    raise exception 'Scheduler proof replay accepted';
  end if;
  begin
    perform 1 from public.quote_followup_scheduler_nonces;
    raise exception 'Service role read nonce table directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.quote_followup_scheduler_nonces(nonce,issued_at) values(gen_random_uuid(),epoch);
    raise exception 'Service role forged nonce row directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.quote_followup_scheduler_nonces;
    raise exception 'Service role removed replay protections directly';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
do $$ begin
  if exists(select 1 from public.quote_followup_scheduler_nonces where nonce='da000000-0000-4000-8000-000000000001') then
    raise exception 'Expired scheduler nonce not cleaned';
  end if;
  if (select count(*) from public.quote_followup_scheduler_nonces)<>4 then
    raise exception 'Recent replay protection removed or duplicate created';
  end if;
end $$;
rollback;
