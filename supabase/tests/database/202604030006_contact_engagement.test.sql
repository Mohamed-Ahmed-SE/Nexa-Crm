begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'engagement-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'engagement-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('61000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'engagement-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('61000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'engagement-foreign@example.test', '', now(), '{}', '{}', now(), now()),
  ('61000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'engagement-manager@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('62000000-0000-4000-8000-000000000001', 'Engagement Workspace One', 'engagement-one', 'USD'),
  ('62000000-0000-4000-8000-000000000002', 'Engagement Workspace Two', 'engagement-two', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'admin'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'member'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'viewer'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'manager'),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000004', 'member'),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000005', 'manager');

insert into public.contacts (id, workspace_id, first_name, last_name, owner_id, created_by)
values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Owned', 'Contact', '61000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'Other', 'Contact', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000002', 'Foreign', 'Contact', '61000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000004');

insert into public.notes (id, workspace_id, body, created_by, related_entity_type, related_entity_id)
values ('64000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Initial note', '61000000-0000-4000-8000-000000000001', 'contact', '63000000-0000-4000-8000-000000000001');

select ok((select not public from storage.buckets where id = 'contact-attachments'), 'contact attachment bucket is private');
select ok(
  not has_column_privilege('authenticated', 'public.tasks', 'workspace_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tasks', 'created_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.notes', 'workspace_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.notes', 'created_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.attachments', 'uploaded_by', 'UPDATE'),
  'protected workspace and identity columns are not updateable by authenticated users'
);
select ok(
  has_column_privilege('authenticated', 'public.tasks', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tasks', 'assigned_to', 'UPDATE')
  and has_column_privilege('authenticated', 'public.notes', 'body', 'UPDATE')
  and has_column_privilege('authenticated', 'public.notes', 'is_pinned', 'UPDATE'),
  'approved task and note fields remain updateable'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.notes), 1, 'workspace member reads notes in their workspace');
select is((select count(*)::integer from public.notes where workspace_id = '62000000-0000-4000-8000-000000000002'), 0, 'member cannot read another workspace notes');
insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
values ('62000000-0000-4000-8000-000000000001', 'Member note', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.notes where body = 'Member note'), 1, 'member may add a note to an owned contact');
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', 'Foreign contact note', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "notes"', 'member cannot create a note on a contact they do not own'
);
insert into public.tasks (workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id)
values ('62000000-0000-4000-8000-000000000001', 'Contact follow-up', '61000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.tasks where title = 'Contact follow-up'), 1, 'member may create an assigned task for an owned contact');
select throws_ok(
  $$update public.tasks set assigned_to = '61000000-0000-4000-8000-000000000005' where title = 'Contact follow-up'$$,
  '42501', 'Members cannot reassign tasks', 'member cannot reassign a task through the owned-contact update policy'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000002', 'Cross-workspace task', '61000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000003')$$,
  '42501', 'new row violates row-level security policy for table "tasks"', 'member cannot write an engagement record into another workspace'
);
insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id)
values ('62000000-0000-4000-8000-000000000001', 'call', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.activities), 1, 'member may append a manual activity on an owned contact');
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id, is_system_event) values ('62000000-0000-4000-8000-000000000001', 'system', '61000000-0000-4000-8000-000000000002', 'contact', '63000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'new row violates row-level security policy for table "activities"', 'member cannot create system activities'
);
select ok(not has_table_privilege('authenticated', 'public.activities', 'UPDATE') and not has_table_privilege('authenticated', 'public.activities', 'DELETE'), 'authenticated users cannot alter or delete append-only activities');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000005', true);
update public.tasks set title = 'Manager edited follow-up', assigned_to = '61000000-0000-4000-8000-000000000005'
where title = 'Contact follow-up';
select is(
  (select count(*)::integer from public.tasks where title = 'Manager edited follow-up' and assigned_to = '61000000-0000-4000-8000-000000000005'),
  1, 'manager can edit and reassign a member task'
);
select throws_ok(
  $$update public.tasks set workspace_id = '62000000-0000-4000-8000-000000000002' where title = 'Manager edited follow-up'$$,
  '42501', null, 'multi-workspace manager cannot change a task workspace'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.notes), 2, 'viewer can read workspace notes');
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', 'Viewer note', '61000000-0000-4000-8000-000000000003', 'contact', '63000000-0000-4000-8000-000000000001')$$,
  '42501', 'new row violates row-level security policy for table "notes"', 'viewer cannot create notes'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', 'Viewer task', '61000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003', 'contact', '63000000-0000-4000-8000-000000000001')$$,
  '42501', 'new row violates row-level security policy for table "tasks"', 'viewer cannot create tasks'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', 'Wrong workspace target', '61000000-0000-4000-8000-000000000001', 'contact', '63000000-0000-4000-8000-000000000003')$$,
  '23503', 'Related contact must exist in the record workspace', 'manager cannot associate a note with a contact from another workspace'
);
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001/63000000-0000-4000-8000-000000000001/file-1/test.pdf', 'test.pdf', 'application/pdf', 10, '61000000-0000-4000-8000-000000000001', 'contact', '63000000-0000-4000-8000-000000000003')$$,
  '23503', 'Related contact must exist in the record workspace', 'manager cannot attach metadata to a foreign contact'
);
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('62000000-0000-4000-8000-000000000001', 'Cross workspace spoof', '61000000-0000-4000-8000-000000000004', 'contact', '63000000-0000-4000-8000-000000000001')$$,
  '42501', 'new row violates row-level security policy for table "notes"', 'foreign workspace member cannot write engagement to another workspace'
);

select * from finish();
rollback;
