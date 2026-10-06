begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'task-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'task-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'task-assignee@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('82000000-0000-4000-8000-000000000001', 'Task Workspace', 'task-workspace', 'USD'), ('82000000-0000-4000-8000-000000000002', 'Other Workspace', 'other-task-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'member'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'viewer'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 'member'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.tasks (workspace_id, title, created_by, assigned_to) values ('82000000-0000-4000-8000-000000000001', 'Unlinked member task', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001')$$,
  'member may create a task assigned to self without a linked record'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by, assigned_to) values ('82000000-0000-4000-8000-000000000001', 'Assigned to peer', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'member cannot use the unlinked policy to assign another user'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by, assigned_to) values ('82000000-0000-4000-8000-000000000002', 'Foreign workspace task', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'member cannot create an unlinked task in another workspace'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by, assigned_to) values ('82000000-0000-4000-8000-000000000001', 'Viewer task', '81000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'viewer cannot create an unlinked task'
);
select is((select count(*)::integer from public.tasks), 1, 'viewer may read workspace tasks but cannot create them');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.tasks where workspace_id = '82000000-0000-4000-8000-000000000001'), 1, 'member can read the created task in their workspace');
select is((select count(*)::integer from public.tasks where workspace_id = '82000000-0000-4000-8000-000000000002'), 0, 'member cannot read tasks from another workspace');
select * from finish();
rollback;
