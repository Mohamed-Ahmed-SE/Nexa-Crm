begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'company-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'company-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'company-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'company-foreign@example.test', '', now(), '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'company-manager@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('72000000-0000-4000-8000-000000000001', 'Company Workspace One', 'company-one', 'USD'),
  ('72000000-0000-4000-8000-000000000002', 'Company Workspace Two', 'company-two', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'admin'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'member'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'viewer'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000005', 'manager'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000004', 'member');
insert into public.companies (id, workspace_id, name, owner_id, created_by)
values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Member company', '71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'Admin company', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000002', 'Foreign company', '71000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004');
insert into public.contacts (id, workspace_id, company_id, first_name, last_name, owner_id, created_by)
values ('74000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'Member', 'Contact', '71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001');

select ok((select not public from storage.buckets where id = 'company-attachments'), 'company attachment bucket is private');
select ok((select count(*) = 3 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'company_attachments_%'), 'company storage has separate scoped read, insert, and delete policies');
select ok(not has_column_privilege('authenticated', 'public.attachments', 'workspace_id', 'UPDATE') and not has_column_privilege('authenticated', 'public.attachments', 'uploaded_by', 'UPDATE'), 'attachment identity columns stay protected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.companies), 2, 'member can read companies in their workspace');
select is((select count(*)::integer from public.companies where workspace_id = '72000000-0000-4000-8000-000000000002'), 0, 'member cannot read foreign workspace companies');
insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
values ('72000000-0000-4000-8000-000000000001', 'Owned company note', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.notes where body = 'Owned company note'), 1, 'member can add notes to an owned company');
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', 'Other company note', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "notes"', 'member cannot add notes to a company they do not own'
);
insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id)
values ('72000000-0000-4000-8000-000000000001', 'call', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.activities where related_entity_type = 'company'), 1, 'member can append activity to an owned company');
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', 'call', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "activities"', 'member cannot append activity to unowned company'
);
insert into public.tasks (workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id)
values ('72000000-0000-4000-8000-000000000001', 'Company follow-up', '71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.tasks where title = 'Company follow-up'), 1, 'member can create assigned task for owned company');
update public.tasks set status = 'completed', completed_at = now() where title = 'Company follow-up';
select is((select count(*)::integer from public.tasks where title = 'Company follow-up' and status = 'completed'), 1, 'assigned member can complete company task');
select throws_ok(
  $$update public.tasks set assigned_to = '71000000-0000-4000-8000-000000000005' where title = 'Company follow-up'$$,
  '42501', 'Members cannot reassign tasks', 'company policy does not let member reassign tasks'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000002', 'Foreign company task', '71000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000003')$$,
  '23503', 'Related company must exist in the record workspace', 'member cannot create company task in another workspace'
);
insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
values ('72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/file-1/test.pdf', 'test.pdf', 'application/pdf', 10, '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.attachments where related_entity_type = 'company'), 1, 'member can add file metadata for owned company');
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000002/file-2/test.pdf', 'test.pdf', 'application/pdf', 10, '71000000-0000-4000-8000-000000000002', 'company', '73000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "attachments"', 'member cannot add file metadata to unowned company'
);
insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
values ('72000000-0000-4000-8000-000000000001', 'Contact still works', '71000000-0000-4000-8000-000000000002', 'contact', '74000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.notes where body = 'Contact still works'), 1, 'company policy extension preserves owned-contact note access');

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', 'Viewer company note', '71000000-0000-4000-8000-000000000003', 'company', '73000000-0000-4000-8000-000000000001')$$,
  '42501', 'new row violates row-level security policy for table "notes"', 'viewer cannot create company notes'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', 'Missing target', '71000000-0000-4000-8000-000000000001', 'company', '73000000-0000-4000-8000-000000000003')$$,
  '23503', 'Related company must exist in the record workspace', 'target trigger rejects foreign-workspace company IDs'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id) values ('72000000-0000-4000-8000-000000000001', 'Manager note', '71000000-0000-4000-8000-000000000001', 'company', '73000000-0000-4000-8000-000000000001')$$,
  'manager can add notes to a company owned by another member'
);

select * from finish();
rollback;
