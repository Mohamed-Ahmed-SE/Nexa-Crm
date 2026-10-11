begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'reminder-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'reminder-other@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('b2000000-0000-4000-8000-000000000001', 'Reminder Workspace', 'reminder-workspace', 'USD'),
       ('b2000000-0000-4000-8000-000000000002', 'Other Reminder Workspace', 'other-reminder-workspace', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'member'),
       ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'member');

insert into public.tasks (id, workspace_id, title, status, assigned_to, created_by, reminder_at, completed_at)
values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Future reminder', 'open', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', now() + interval '1 hour', null),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'Due reminder', 'open', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', now() - interval '1 minute', null),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'Completed reminder', 'completed', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', now() - interval '1 minute', now()),
  ('b3000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001', 'Cancelled reminder', 'cancelled', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', now() - interval '1 minute', null),
  ('b3000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000001', 'Unassigned reminder', 'open', null, 'b1000000-0000-4000-8000-000000000001', now() - interval '1 minute', null),
  ('b3000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000002', 'Cross-workspace reminder', 'open', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', now() - interval '1 minute', null);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select public.generate_task_notifications('b2000000-0000-4000-8000-000000000001', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
reset role;
select is((select count(*)::integer from public.tasks t join public.workspace_members wm on wm.workspace_id = t.workspace_id and wm.user_id = t.assigned_to and wm.status = 'active' where t.id = 'b3000000-0000-4000-8000-000000000002' and t.status = 'open' and t.reminder_at <= now()), 1, 'fixture has one assigned active-member reminder that is due');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000001'), 0, 'future reminder is not generated early');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000002'), 1, 'due reminder is generated for its assigned member');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and recipient_id = 'b1000000-0000-4000-8000-000000000001'), 1, 'reminder is addressed to the task assignee only');
select is((select count(*)::integer from public.notifications n join public.tasks t on t.workspace_id = n.workspace_id and t.id = n.task_id where n.notification_type = 'task_reminder' and n.recipient_id = t.assigned_to), 1, 'reminder recipient matches the task assignee');
select public.generate_task_notifications('b2000000-0000-4000-8000-000000000001', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000002'), 1, 'refresh does not duplicate an unchanged reminder');
reset role;
update public.tasks set reminder_at = now() - interval '2 minutes' where id = 'b3000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.generate_task_notifications('b2000000-0000-4000-8000-000000000001', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000002'), 2, 'a changed reminder timestamp can produce a new notification');
select public.generate_task_notifications('b2000000-0000-4000-8000-000000000001', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000002'), 2, 'refresh does not duplicate a notification for a changed timestamp');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id in ('b3000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000004')), 0, 'completed and cancelled tasks do not generate reminders');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and task_id = 'b3000000-0000-4000-8000-000000000005'), 0, 'unassigned tasks do not generate reminders');
select is((select count(*)::integer from public.notifications where notification_type = 'task_reminder' and workspace_id = 'b2000000-0000-4000-8000-000000000002'), 0, 'generation for one workspace excludes another workspace task');
select * from finish();
rollback;
