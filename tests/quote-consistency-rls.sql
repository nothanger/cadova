-- Disposable local database. Verifies communicated-summary locking and stale writes.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end $$;
insert into auth.users(id,email) values
 ('c1000000-0000-4000-8000-000000000001','consistency-owner@example.test'),
 ('c1000000-0000-4000-8000-000000000002','consistency-other@example.test');
insert into public.companies(id,name) values
 ('c2000000-0000-4000-8000-000000000001','Consistency company'),
 ('c2000000-0000-4000-8000-000000000002','Other company');
insert into public.company_members(company_id,user_id,role) values
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','owner'),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','owner');
insert into public.clients(id,company_id,name,email) values
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Client A','a@example.test'),
 ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Client B','b@example.test'),
 ('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000002','Other client','other@example.test');
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at)
 select ('c4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','LOCK-'||n,10000,
  case n when 1 then 'draft' when 4 then 'accepted' when 5 then 'refused' else 'sent' end,
  case when n=1 then null else current_date-1 end from generate_series(1,6)n;
insert into public.quotes(id,company_id,client_id,reference,amount_cents,status,sent_at) values
 ('c4000000-0000-4000-8000-000000000099','c2000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003','OTHER',10000,'sent',current_date-1);
insert into storage.objects(bucket_id,name,metadata) values
 ('quote-documents','c2000000-0000-4000-8000-000000000001/c1000000-0000-4000-8000-000000000001/c5000000-0000-4000-8000-000000000001.pdf','{"mimetype":"application/pdf","size":9}');
insert into public.quote_documents(id,company_id,quote_id,storage_path,file_name,size_bytes,uploaded_by) values
 ('c5000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001/c1000000-0000-4000-8000-000000000001/c5000000-0000-4000-8000-000000000001.pdf','devis.pdf',9,'c1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select public.update_quote_if_current('c4000000-0000-4000-8000-000000000001',(select updated_at from public.quotes where id='c4000000-0000-4000-8000-000000000001'),'c3000000-0000-4000-8000-000000000002','DRAFT-CORRECTED',12000,'draft',null,null,'Correction avant communication');
select pg_temp.assert((select client_id='c3000000-0000-4000-8000-000000000002' and reference='DRAFT-CORRECTED' and amount_cents=12000 from public.quotes where id='c4000000-0000-4000-8000-000000000001'),'Draft commercial fields could not be corrected');
select public.update_quote_if_current('c4000000-0000-4000-8000-000000000002',(select updated_at from public.quotes where id='c4000000-0000-4000-8000-000000000002'),'c3000000-0000-4000-8000-000000000001','LOCK-2',10000,'sent',current_date-1,null,'Administrative note');
select pg_temp.assert((select notes='Administrative note' from public.quotes where id='c4000000-0000-4000-8000-000000000002'),'Safe administrative correction was blocked');
do $$ declare target uuid; begin
 foreach target in array array[
  'c4000000-0000-4000-8000-000000000002'::uuid,
  'c4000000-0000-4000-8000-000000000003'::uuid,
  'c4000000-0000-4000-8000-000000000004'::uuid,
  'c4000000-0000-4000-8000-000000000005'::uuid
 ] loop
  begin update public.quotes set amount_cents=amount_cents+1 where id=target; raise exception 'Communicated amount changed for %',target; exception when check_violation then null; end;
 end loop;
 begin update public.quotes set status='draft',sent_at=null where id='c4000000-0000-4000-8000-000000000003'; raise exception 'Communicated quote returned to draft'; exception when check_violation then null; end;
 begin update public.quotes set client_id='c3000000-0000-4000-8000-000000000003' where id='c4000000-0000-4000-8000-000000000002'; raise exception 'Cross-company client accepted'; exception when check_violation then null; end;
end $$;
do $$ declare stale timestamptz; begin
 select updated_at-interval '1 second' into stale from public.quotes where id='c4000000-0000-4000-8000-000000000006';
 update public.quotes set status='accepted' where id='c4000000-0000-4000-8000-000000000006';
 begin perform public.set_quote_status_if_current('c4000000-0000-4000-8000-000000000006',stale,'refused','Devis refusé.'); raise exception 'Stale status overwrote a newer decision'; exception when serialization_failure then null; end;
 perform pg_temp.assert((select status='accepted' from public.quotes where id='c4000000-0000-4000-8000-000000000006'),'Newer decision was overwritten');
end $$;
select public.set_quote_status_if_current('c4000000-0000-4000-8000-000000000003',(select updated_at from public.quotes where id='c4000000-0000-4000-8000-000000000003'),'refused','Devis refusé : budget reporté.');
select pg_temp.assert((select status='refused' from public.quotes where id='c4000000-0000-4000-8000-000000000003'),'Current status correction failed');
select pg_temp.assert((select count(*)=1 from public.quote_events where quote_id='c4000000-0000-4000-8000-000000000003' and event_type='status_change' and content='Devis refusé : budget reporté.'),'Status correction history is not atomic');
do $$ begin
 begin perform public.set_quote_status_if_current('c4000000-0000-4000-8000-000000000099',(select updated_at from public.quotes where id='c4000000-0000-4000-8000-000000000099'),'accepted','Forged'); raise exception 'Other tenant quote changed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
