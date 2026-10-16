begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'task-edit-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'task-edit-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'task-edit-manager@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('92000000-0000-4000-8000-000000000001', 'Task Edit Workspace', 'task-edit-workspace', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'member'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'member'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'manager');
insert into public.tasks (id, workspace_id, title, status, assigned_to, created_by)
values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Member unlinked task', 'open', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Peer unlinked task', 'open', '91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

-- A member can edit every column updateTaskAction writes on their own assigned task.
select lives_ok(
  $$update public.tasks set title = 'Revise the proposal', description = 'Double-check pricing.', task_type = 'follow_up', priority = 'high', due_at = now() + interval '1 day' where id = '93000000-0000-4000-8000-000000000001'$$,
  'member can update title, description, task_type, priority, and due_at on their own task'
);
select is((select title from public.tasks where id = '93000000-0000-4000-8000-000000000001'), 'Revise the proposal', 'the edited title is persisted');

-- A member cannot reassign their own task to a peer (blocked by the member-reassignment trigger and grant-level RLS check).
select throws_ok(
  $$update public.tasks set assigned_to = '91000000-0000-4000-8000-000000000002' where id = '93000000-0000-4000-8000-000000000001'$$,
  '42501', 'Members cannot reassign tasks', 'member cannot reassign their own task to a peer'
);

-- A member cannot edit a task assigned to someone else with no related record they own.
select throws_ok(
  $$update public.tasks set title = 'Hijacked title' where id = '93000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'member cannot edit a peer''s unrelated task'
);
select is((select count(*)::integer from public.tasks where id = '93000000-0000-4000-8000-000000000002' and title = 'Hijacked title'), 0, 'the peer task title is unchanged');

-- A manager can edit and reassign any task in the workspace.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$update public.tasks set title = 'Manager reassigned task', assigned_to = '91000000-0000-4000-8000-000000000001' where id = '93000000-0000-4000-8000-000000000002'$$,
  'manager can edit and reassign a task assigned to any workspace member'
);
select is((select assigned_to::text from public.tasks where id = '93000000-0000-4000-8000-000000000002'), '91000000-0000-4000-8000-000000000001', 'the manager reassignment is persisted');

-- A manager cannot assign a task to someone outside the workspace (foreign key on workspace_members).
select throws_ok(
  $$update public.tasks set assigned_to = '91000000-0000-4000-8000-000000000099' where id = '93000000-0000-4000-8000-000000000002'$$,
  '23503', null, 'assigning a task to a non-member fails the workspace_members foreign key'
);

select * from finish();
rollback;
