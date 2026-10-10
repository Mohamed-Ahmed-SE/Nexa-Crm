begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'task-audit-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'task-audit-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'task-audit-foreign@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values
  ('d1200000-0000-4000-8000-000000000001', 'Task Audit Workspace', 'task-audit-workspace', 'USD'),
  ('d1200000-0000-4000-8000-000000000002', 'Foreign Task Audit Workspace', 'foreign-task-audit-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'member'),
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'member'),
  ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000001', 'member'),
  ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000003', 'member');
insert into public.companies (id, workspace_id, name, owner_id, created_by)
values
  ('d1300000-0000-4000-8000-000000000001', 'd1200000-0000-4000-8000-000000000001', 'Peer-owned task company', 'd1100000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002'),
  ('d1300000-0000-4000-8000-000000000002', 'd1200000-0000-4000-8000-000000000001', 'Other task company', 'd1100000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002'),
  ('d1300000-0000-4000-8000-000000000003', 'd1200000-0000-4000-8000-000000000002', 'Foreign task company', 'd1100000-0000-4000-8000-000000000003', 'd1100000-0000-4000-8000-000000000003');
insert into public.tasks (id, workspace_id, title, status, completed_at, assigned_to, created_by, related_entity_type, related_entity_id)
values
  ('d1400000-0000-4000-8000-000000000001', 'd1200000-0000-4000-8000-000000000001', 'Assigned completed task', 'completed', now(), 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'company', 'd1300000-0000-4000-8000-000000000001'),
  ('d1400000-0000-4000-8000-000000000002', 'd1200000-0000-4000-8000-000000000001', 'Unassigned completed task', 'completed', now(), null, 'd1100000-0000-4000-8000-000000000002', 'company', 'd1300000-0000-4000-8000-000000000001'),
  ('d1400000-0000-4000-8000-000000000003', 'd1200000-0000-4000-8000-000000000001', 'Assigned open task', 'open', null, 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'company', 'd1300000-0000-4000-8000-000000000001'),
  ('d1400000-0000-4000-8000-000000000004', 'd1200000-0000-4000-8000-000000000001', 'Other-company task', 'completed', now(), 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'company', 'd1300000-0000-4000-8000-000000000002'),
  ('d1400000-0000-4000-8000-000000000005', 'd1200000-0000-4000-8000-000000000002', 'Foreign-workspace task', 'completed', now(), 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000003', 'company', 'd1300000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event)
    values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'Task completed', 'Assigned completed task', now(), 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000001"}', false)$$,
  'assigned member can record completion on a company they do not own'
);
select is((select count(*)::integer from public.activities where activity_type = 'task_completed'), 1, 'assigned-member completion event is persisted');
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000099"}', false)$$,
  '42501', null, 'member cannot record completion for an unrelated task ID'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000002"}', false)$$,
  '42501', null, 'member cannot record completion for an unassigned task'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000003"}', false)$$,
  '42501', null, 'member cannot record completion for an incomplete task'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000004"}', false)$$,
  '42501', null, 'member cannot record an event on a different company than the task'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000005"}', false)$$,
  '42501', null, 'member cannot record completion for a task in another workspace'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'call', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000001"}', false)$$,
  '42501', null, 'member cannot use the task policy for unrelated activity types'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000001"}', true)$$,
  '42501', null, 'member cannot insert a system task completion event'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event) values ('d1200000-0000-4000-8000-000000000001', 'task_completed', 'd1100000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002', 'company', 'd1300000-0000-4000-8000-000000000001', '{"task_id":"d1400000-0000-4000-8000-000000000001"}', false)$$,
  '42501', null, 'member cannot create a completion event as another user'
);
select is((select count(*)::integer from public.activities where activity_type = 'task_completed'), 1, 'rejected completion attempts persist no additional activities');

select * from finish();
rollback;
