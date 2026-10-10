begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'notice-admin@example.test', '', now(), '{}', '{"full_name":"Notice Admin"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'notice-manager@example.test', '', now(), '{}', '{"full_name":"Notice Manager"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'notice-member@example.test', '', now(), '{}', '{"full_name":"Notice Member"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'notice-viewer@example.test', '', now(), '{}', '{"full_name":"Notice Viewer"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'invitee@example.test', '', now(), '{}', '{"full_name":"Invitee"}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('a2000000-0000-4000-8000-000000000001', 'Notifications Workspace', 'notifications-workspace', 'USD'),
       ('a2000000-0000-4000-8000-000000000002', 'Other Workspace', 'other-notifications-workspace', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'admin'),
       ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'manager'),
       ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'member'),
       ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'viewer'),
       ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', 'member');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by)
values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Assigned Lead', 'USD', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
       ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'Self Assigned Lead', 'USD', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');
insert into public.tasks (id, workspace_id, title, status, priority, due_at, assigned_to, created_by, completed_at)
values
  ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Due now task', 'open', 'medium', now(), 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', null),
  ('a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'Overdue task', 'open', 'medium', date_trunc('day', now()) - interval '1 hour', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', null),
  ('a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'Completed task', 'completed', 'medium', now(), 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', now()),
  ('a4000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'Cancelled task', 'cancelled', 'medium', now(), 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', null),
  ('a4000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'Unassigned task', 'open', 'medium', now(), null, 'a1000000-0000-4000-8000-000000000001', null);
insert into public.notifications (workspace_id, recipient_id, notification_type, title, message, event_key)
values ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', 'invite_accepted', 'Invitation accepted', 'Other workspace invite', 'scope-fixture');
insert into public.workspace_invites (id, workspace_id, email, role, token_hash, invited_by)
values ('a5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'invitee@example.test', 'member', repeat('a', 64), 'a1000000-0000-4000-8000-000000000001');
insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by)
select 'a6000000-0000-4000-8000-000000000001', p.workspace_id, p.id, ps.id, 'Won deal', 100, 'USD', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'
from public.pipelines p join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id
where p.workspace_id = 'a2000000-0000-4000-8000-000000000001' and p.is_default and ps.stage_type = 'open' limit 1;

select ok(not has_function_privilege('anon', 'public.generate_task_notifications(uuid,timestamp with time zone,timestamp with time zone)', 'EXECUTE'), 'anonymous users cannot generate task notifications');
select ok(not has_function_privilege('public', 'public.generate_task_notifications(uuid,timestamp with time zone,timestamp with time zone)', 'EXECUTE'), 'public cannot execute task notification generation');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
update public.leads set owner_id = 'a1000000-0000-4000-8000-000000000003' where id = 'a3000000-0000-4000-8000-000000000001';
update public.leads set owner_id = 'a1000000-0000-4000-8000-000000000001' where id = 'a3000000-0000-4000-8000-000000000002';
reset role;
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000003' and notification_type = 'lead_assigned'), 1, 'owner change notifies the new assignee');
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000001' and notification_type = 'lead_assigned'), 0, 'acting assignee does not receive an assignment notification');
select is((select count(*)::integer from public.notifications where notification_type = 'deal_assigned' and recipient_id = 'a1000000-0000-4000-8000-000000000002'), 1, 'deal assignment is generated for its owner');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.generate_task_notifications('a2000000-0000-4000-8000-000000000001', pg_catalog.date_trunc('day', pg_catalog.now()), pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day')$$, 'active task owner can generate their inbox reminders');
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000003' and notification_type in ('task_due', 'task_overdue')), 2, 'open due and overdue tasks generate reminders only for their assignee');
select lives_ok($$select public.generate_task_notifications('a2000000-0000-4000-8000-000000000001', pg_catalog.date_trunc('day', pg_catalog.now()), pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day')$$, 'repeated inbox generation is allowed');
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000003' and notification_type in ('task_due', 'task_overdue')), 2, 'repeated generation does not duplicate task notifications');
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000003' and task_id in ('a4000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000004')), 0, 'completed and cancelled tasks do not generate reminders');
select is((select count(*)::integer from public.notifications where task_id = 'a4000000-0000-4000-8000-000000000005'), 0, 'unassigned tasks do not generate reminders');
select is((select count(*)::integer from public.notifications where workspace_id = 'a2000000-0000-4000-8000-000000000002'), 0, 'notification generation preserves workspace isolation');
select throws_ok($$select public.generate_task_notifications('a2000000-0000-4000-8000-000000000002', pg_catalog.date_trunc('day', pg_catalog.now()), pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day')$$, '42501', null, 'a member cannot generate notifications for another workspace');
select is((select count(*)::integer from public.notifications where recipient_id <> 'a1000000-0000-4000-8000-000000000003'), 0, 'member RLS exposes only notifications addressed to the caller');
select is((select count(*)::integer from public.notifications where workspace_id = 'a2000000-0000-4000-8000-000000000002'), 0, 'member RLS hides another workspace notification even when it exists');
update public.notifications set read_at = now() where recipient_id = 'a1000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000001' and read_at is not null), 0, 'a recipient cannot mark another users notification as read');
set local role authenticated;
select throws_ok($$select public.generate_task_notifications('a2000000-0000-4000-8000-000000000001', pg_catalog.now(), pg_catalog.now())$$, '22023', null, 'invalid browser-day bounds are rejected');
select lives_ok($$update public.notifications set read_at = now() where recipient_id = 'a1000000-0000-4000-8000-000000000003' and notification_type = 'task_due'$$, 'a recipient can mark their own notification as read');
select is((select count(*)::integer from public.notifications where recipient_id = 'a1000000-0000-4000-8000-000000000003' and notification_type = 'task_due' and read_at is not null), 1, 'the read-state change is persisted');
select throws_ok($$update public.notifications set title = 'Forged' where recipient_id = 'a1000000-0000-4000-8000-000000000003'$$, '42501', null, 'clients cannot edit protected notification fields');
select throws_ok($$insert into public.notifications (workspace_id, recipient_id, notification_type, title, message, event_key) values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'task_due', 'Forged', 'Forged', 'forged')$$, '42501', null, 'clients cannot create arbitrary notifications');
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
set local role authenticated;
update public.deals set stage_id = (
  select ps.id from public.pipeline_stages ps
  where ps.workspace_id = deals.workspace_id and ps.pipeline_id = deals.pipeline_id and ps.stage_type = 'won'
) where id = 'a6000000-0000-4000-8000-000000000001';
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'deal_won' and recipient_id = 'a1000000-0000-4000-8000-000000000001'), 1, 'deal outcome notifies an active workspace admin other than the actor');
select is((select count(*)::integer from public.notifications where notification_type = 'deal_won' and recipient_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'deal outcome excludes the manager who made the change');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
update public.deals set stage_id = (
  select ps.id from public.pipeline_stages ps
  where ps.workspace_id = deals.workspace_id and ps.pipeline_id = deals.pipeline_id and ps.stage_type = 'lost'
) where id = 'a6000000-0000-4000-8000-000000000001';
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'deal_lost' and recipient_id = 'a1000000-0000-4000-8000-000000000002'), 1, 'deal loss notifies an active manager other than the actor');
select is((select count(*)::integer from public.notifications where notification_type = 'deal_lost' and recipient_id = 'a1000000-0000-4000-8000-000000000003'), 0, 'deal outcomes are not sent to regular members');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
select is(public.accept_workspace_invite(repeat('a', 64)), 'a2000000-0000-4000-8000-000000000001'::uuid, 'valid invite acceptance succeeds');
reset role;
select is((select count(*)::integer from public.notifications where notification_type = 'invite_accepted' and recipient_id = 'a1000000-0000-4000-8000-000000000001'), 1, 'accepted invitation notifies its inviter');
select * from finish();
rollback;
