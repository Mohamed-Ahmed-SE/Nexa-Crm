begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lead-engagement-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'lead-engagement-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'lead-engagement-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'lead-engagement-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'lead-engagement-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('d1200000-0000-4000-8000-000000000001', 'Lead Engagement Workspace', 'lead-engagement-workspace', 'USD'),
  ('d1200000-0000-4000-8000-000000000002', 'Foreign Lead Engagement Workspace', 'foreign-lead-engagement-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'member'),
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'member'),
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000003', 'viewer'),
  ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000004', 'manager'),
  ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000005', 'member');

insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by) values
  ('d1300000-0000-4000-8000-000000000001', 'd1200000-0000-4000-8000-000000000001', 'Owned lead', 'USD', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001'),
  ('d1300000-0000-4000-8000-000000000002', 'd1200000-0000-4000-8000-000000000001', 'Peer lead', 'USD', 'd1100000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002'),
  ('d1300000-0000-4000-8000-000000000003', 'd1200000-0000-4000-8000-000000000001', 'Viewer lead', 'USD', 'd1100000-0000-4000-8000-000000000003', 'd1100000-0000-4000-8000-000000000004'),
  ('d1300000-0000-4000-8000-000000000004', 'd1200000-0000-4000-8000-000000000002', 'Foreign lead', 'EUR', 'd1100000-0000-4000-8000-000000000005', 'd1100000-0000-4000-8000-000000000005');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'Call the lead', 'follow_up', 'medium', 'lead', 'd1300000-0000-4000-8000-000000000001')$$,
  'member can create a self-assigned task for an owned lead'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'Lead discussion notes', 'd1100000-0000-4000-8000-000000000001', 'lead', 'd1300000-0000-4000-8000-000000000001')$$,
  'member can add a note to an owned lead'
);
select is((select count(*)::integer from public.tasks where related_entity_id = 'd1300000-0000-4000-8000-000000000001'), 1, 'owned lead task is visible');
select is((select count(*)::integer from public.notes where related_entity_id = 'd1300000-0000-4000-8000-000000000001'), 1, 'owned lead note is visible');
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'Peer task', 'follow_up', 'medium', 'lead', 'd1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot create a task for a peer lead'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'Peer note', 'd1100000-0000-4000-8000-000000000001', 'lead', 'd1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot add a note to a peer lead'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'Foreign task', 'follow_up', 'medium', 'lead', 'd1300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'member cannot create a task in another workspace'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000002', 'Foreign note', 'd1100000-0000-4000-8000-000000000001', 'lead', 'd1300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'member cannot add a note in another workspace'
);
select lives_ok($$update public.tasks set title = 'Call the lead tomorrow' where related_entity_id = 'd1300000-0000-4000-8000-000000000001'$$, 'member can update an owned lead task');
select lives_ok($$update public.notes set body = 'Updated lead discussion notes' where related_entity_id = 'd1300000-0000-4000-8000-000000000001'$$, 'member can update their own note on an owned lead');
select lives_ok($$delete from public.tasks where related_entity_id = 'd1300000-0000-4000-8000-000000000001'$$, 'member can delete an owned lead task');
select lives_ok($$delete from public.notes where related_entity_id = 'd1300000-0000-4000-8000-000000000001'$$, 'member can delete their own note on an owned lead');
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000003', 'd1100000-0000-4000-8000-000000000003', 'Viewer task', 'follow_up', 'medium', 'lead', 'd1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'viewer cannot create a task even for an owned lead'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'Viewer note', 'd1100000-0000-4000-8000-000000000003', 'lead', 'd1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'viewer cannot add a note even to an owned lead'
);
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, title, task_type, priority, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000004', 'Manager task', 'follow_up', 'medium', 'lead', 'd1300000-0000-4000-8000-000000000002')$$,
  'manager retains the existing task policy behavior'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('d1200000-0000-4000-8000-000000000001', 'Manager note', 'd1100000-0000-4000-8000-000000000004', 'lead', 'd1300000-0000-4000-8000-000000000002')$$,
  'manager retains the existing note policy behavior'
);

select * from finish();
rollback;
