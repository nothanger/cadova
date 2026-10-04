-- Disposable PostgreSQL test after migration 0007. Every fixture is rolled back.
begin;
insert into auth.users (id, email, banned_until) values
  ('81000000-0000-4000-8000-000000000001', 'admin-one@example.test', null),
  ('81000000-0000-4000-8000-000000000002', 'admin-two@example.test', null),
  ('81000000-0000-4000-8000-000000000003', 'banned-admin@example.test', now() + interval '1 day'),
  ('82000000-0000-4000-8000-000000000001', 'user-one@example.test', null),
  ('82000000-0000-4000-8000-000000000002', 'user-two@example.test', null),
  ('82000000-0000-4000-8000-000000000003', 'banned-user@example.test', now() + interval '1 day');
insert into auth.users (id, email)
  select ('83000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'bulk-' || g || '@example.test'
  from generate_series(1, 30) g;
insert into public.platform_admins (user_id) values
  ('81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003');
insert into public.support_threads (id, user_id) values
  ('84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002'),
  ('84000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000001', true);
do $$
declare thread uuid; retry uuid;
begin
  if (select count(*) from public.company_members) <> 0 then raise exception 'No-company fixture unexpectedly has membership'; end if;
  thread := public.send_support_message('Bonjour, une question sur mes devis.', null, '85000000-0000-4000-8000-000000000001');
  retry := public.send_support_message('Bonjour, une question sur mes devis.', null, '85000000-0000-4000-8000-000000000001');
  if thread <> retry then raise exception 'Retry created a new thread'; end if;
  if (select count(*) from public.support_threads) <> 1 then raise exception 'Normal thread isolation failed'; end if;
  if (select count(*) from public.support_messages) <> 1 then raise exception 'Support retry duplicated a message'; end if;
  if (select sender_role from public.support_messages limit 1) <> 'user' then raise exception 'Sender role forged'; end if;
  if (select count(*) from public.list_support_threads()) <> 1 then raise exception 'Own support thread missing without company'; end if;
  if (select user_email from public.list_support_threads() limit 1) <> 'user-one@example.test' then raise exception 'Own thread email incorrect'; end if;
  begin
    perform public.send_support_message('Changed retry', null, '85000000-0000-4000-8000-000000000001');
    raise exception 'Retry accepted different content';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_support_message('Bonjour, une question sur mes devis.', '84000000-0000-4000-8000-000000000002', '85000000-0000-4000-8000-000000000001');
    raise exception 'Support retry accepted a different thread';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_support_message('Forbidden', '84000000-0000-4000-8000-000000000002');
    raise exception 'Normal user wrote in another thread';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.support_messages;
    raise exception 'Message deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mark_support_thread_read('84000000-0000-4000-8000-000000000002');
    raise exception 'Normal user marked another thread read';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.support_messages(thread_id,sender_id,sender_role,body,request_id) values(thread,auth.uid(),'admin','Forged reply',gen_random_uuid());
    raise exception 'Direct message role forgery allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.support_threads(user_id) values(auth.uid());
    raise exception 'Direct thread write allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.support_messages set body = 'Changed';
    raise exception 'Message edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_admin_notification('Forbidden','Forbidden broadcast');
    raise exception 'Normal user broadcast allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_admin_notification('Forbidden','Forbidden direct','82000000-0000-4000-8000-000000000002');
    raise exception 'Normal user direct admin message allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_support_message(repeat('a',4001));
    raise exception 'Oversize support message accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_support_message('   ');
    raise exception 'Empty support message accepted';
  exception when invalid_parameter_value then null; end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.notifications where type = 'support_message') <> 2 then raise exception 'Support message did not notify both active admins'; end if;
  if exists (select 1 from public.notifications where user_id = '81000000-0000-4000-8000-000000000003') then raise exception 'Banned admin received support message'; end if;
  if exists (select 1 from public.notifications where type = 'support_message' and company_id is not null) then raise exception 'Support message acquired fake company'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000002', true);
select public.send_support_message('Question du second utilisateur.', '84000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
do $$
declare thread uuid; retry uuid;
begin
  if (select count(*) from public.list_support_threads()) <> 3 then raise exception 'Admin support scope missing'; end if;
  if (select count(*) from public.list_support_threads(1,1)) <> 2 then raise exception 'Support pagination lookahead missing'; end if;
  if (select count(*) from public.list_support_threads(3,1)) <> 1 then raise exception 'Support pagination offset wrong'; end if;
  select id into thread from public.support_threads where user_id = '82000000-0000-4000-8000-000000000001';
  perform public.send_support_message('Voici une première réponse.', thread, '85000000-0000-4000-8000-000000000002');
  retry := public.send_support_message('Voici une première réponse.', thread, '85000000-0000-4000-8000-000000000002');
  if retry <> thread then raise exception 'Reply retry changed thread'; end if;
  perform public.send_support_message('Voici une seconde réponse.', thread, '85000000-0000-4000-8000-000000000003');
  if (select count(*) from public.support_messages where thread_id = thread and sender_role = 'admin') <> 2 then raise exception 'Repeated replies blocked or duplicated'; end if;
  if (select last_body from public.list_support_threads() where id = thread) <> 'Voici une seconde réponse.' then raise exception 'Thread preview is not latest message'; end if;
  if public.mark_support_thread_read(thread) <> 1 then raise exception 'Admin own unread count wrong'; end if;
  if public.mark_support_thread_read(thread) <> 0 then raise exception 'Mark read is not idempotent'; end if;
  begin
    perform public.send_support_message('Forbidden banned reply','84000000-0000-4000-8000-000000000003');
    raise exception 'Reply reached a banned recipient';
  exception when no_data_found then null; end;
  begin
    perform public.send_support_message('Voici une première réponse.',null,'85000000-0000-4000-8000-000000000002');
    raise exception 'Retry changed explicit destination to own thread';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.list_support_threads(0,25);
    raise exception 'Invalid page accepted';
  exception when invalid_parameter_value then null; end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.notifications where type = 'admin_message' and user_id = '82000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Replies did not notify thread user exactly once each'; end if;
  if (select count(*) from public.notifications where user_id = '81000000-0000-4000-8000-000000000002' and support_thread_id = (select id from public.support_threads where user_id = '82000000-0000-4000-8000-000000000001') and read_at is null) <> 1 then raise exception 'Admin marked another admin notification read'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000001', true);
do $$
declare thread uuid; affected integer;
begin
  select id into thread from public.support_threads where user_id = auth.uid();
  if (select count(*) from public.support_messages) <> 3 then raise exception 'User cannot see complete own conversation'; end if;
  if public.mark_support_thread_read(thread) <> 2 then raise exception 'User own reply read count wrong'; end if;
  begin
    update public.notifications set message = 'Forged content';
    raise exception 'Notification content editable';
  exception when insufficient_privilege then null; end;
  begin
    update public.notifications set user_id = '82000000-0000-4000-8000-000000000002';
    raise exception 'Notification recipient editable';
  exception when insufficient_privilege then null; end;
  begin
    update public.notifications set type = 'admin_announcement';
    raise exception 'Notification type editable';
  exception when insufficient_privilege then null; end;
  begin
    update public.notifications set support_thread_id = '84000000-0000-4000-8000-000000000002';
    raise exception 'Notification conversation editable';
  exception when insufficient_privilege then null; end;
  update public.notifications set read_at = null where user_id = '81000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other user notification editable'; end if;
  update public.notifications set read_at = now();
  get diagnostics affected = row_count;
  if affected <> 2 then raise exception 'Own read_at update no longer works'; end if;
  begin
    insert into public.notifications(user_id,type,title,message) values(auth.uid(),'admin_message','Forged','Forged');
    raise exception 'Notification insert allowed';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
do $$
declare first_result jsonb; retry_result jsonb;
begin
  first_result := public.send_admin_notification('Information Cadova','Une annonce pour tous.',null,'86000000-0000-4000-8000-000000000001');
  retry_result := public.send_admin_notification('Information Cadova','Une annonce pour tous.',null,'86000000-0000-4000-8000-000000000001');
  if first_result <> retry_result or (first_result->>'recipient_count')::integer <> 34 then raise exception 'Bulk did not reach all active users beyond first page'; end if;
  perform public.send_admin_notification('Information Cadova','Une annonce pour tous.',null,'86000000-0000-4000-8000-000000000002');
  if (public.send_admin_notification('Message personnel','Un message ciblé.','82000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000003')->>'recipient_count')::integer <> 1 then raise exception 'Direct notification recipient count incorrect'; end if;
  begin
    perform public.send_admin_notification('Changed','Une annonce pour tous.',null,'86000000-0000-4000-8000-000000000001');
    raise exception 'Announcement retry accepted changed title';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_admin_notification('Information Cadova','Une annonce pour tous.','82000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000001');
    raise exception 'Announcement retry changed recipient';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_admin_notification('Forbidden','Banned recipient.','82000000-0000-4000-8000-000000000003');
    raise exception 'Announcement reached banned recipient';
  exception when no_data_found then null; end;
  begin
    perform public.send_admin_notification('Forbidden','Missing recipient.','89000000-0000-4000-8000-000000000001');
    raise exception 'Announcement reached missing recipient';
  exception when no_data_found then null; end;
  begin
    perform public.send_admin_notification(repeat('t',121),'Oversize title');
    raise exception 'Oversize title accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_admin_notification('Oversize body',repeat('b',4001));
    raise exception 'Oversize body accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_admin_notification('  ','Empty title');
    raise exception 'Empty title accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.support_messages set sender_role = 'user';
    raise exception 'Admin browser rewrote sender role';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.admin_notification_dispatches;
    raise exception 'Browser can access server dispatch journal';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.admin_notification_dispatches) <> 3 then raise exception 'Dispatch retry duplicated journal'; end if;
  if (select count(*) from public.notifications where type = 'admin_announcement') <> 68 then raise exception 'Repeated announcements blocked or retry duplicated'; end if;
  if exists(select 1 from public.notifications n join auth.users u on u.id=n.user_id where u.banned_until>now()) then raise exception 'Suspended recipient received notification'; end if;
  if (select count(distinct user_id) from public.notifications where type='admin_announcement') <> 34 then raise exception 'Broadcast recipients incorrect'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000003', true);
do $$
begin
  if (select count(*) from public.support_threads) <> 0 then raise exception 'Suspended user can read threads'; end if;
  begin perform public.send_support_message('Suspended message'); raise exception 'Suspended user can send'; exception when insufficient_privilege then null; end;
  begin perform public.list_support_threads(); raise exception 'Suspended user can list'; exception when insufficient_privilege then null; end;
  begin perform public.mark_support_thread_read('84000000-0000-4000-8000-000000000003'); raise exception 'Suspended user can mark read'; exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin perform public.send_admin_notification('Banned admin','Forbidden'); raise exception 'Banned admin can broadcast'; exception when insufficient_privilege then null; end;
end;
$$;

set local role anon;
do $$
begin
  begin perform public.send_support_message('Anonymous'); raise exception 'Anonymous can send support message'; exception when insufficient_privilege then null; end;
  begin perform public.list_support_threads(); raise exception 'Anonymous can list support threads'; exception when insufficient_privilege then null; end;
  begin perform public.send_admin_notification('Anonymous','Anonymous'); raise exception 'Anonymous can broadcast'; exception when insufficient_privilege then null; end;
end;
$$;

-- Existing reminder deduplication still works after allowing multiple messages.
reset role;
insert into public.companies(id,name) values('87000000-0000-4000-8000-000000000001','Reminder company');
insert into public.clients(id,company_id,name) values('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','Client');
insert into public.quotes(id,company_id,client_id,reference,amount_cents) values('89000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','DEV-1',10000);
insert into public.notifications(company_id,user_id,type,title,message) values('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','daily_followup_summary','Daily','Daily');
insert into public.notifications(company_id,user_id,type,title,message,related_quote_id) values('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','quote_followup_due','Quote','Quote','89000000-0000-4000-8000-000000000001');
do $$
begin
  begin
    insert into public.notifications(company_id,user_id,type,title,message) values('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','daily_followup_summary','Duplicate','Duplicate');
    raise exception 'Daily summary deduplication broken';
  exception when unique_violation then null; end;
  begin
    insert into public.notifications(company_id,user_id,type,title,message,related_quote_id) values('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','quote_followup_due','Duplicate','Duplicate','89000000-0000-4000-8000-000000000001');
    raise exception 'Quote reminder deduplication broken';
  exception when unique_violation then null; end;
end;
$$;
rollback;
