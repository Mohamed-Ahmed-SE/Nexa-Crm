begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'import-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'import-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'import-foreign@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('c1200000-0000-4000-8000-000000000001', 'Import workspace', 'import-workspace', 'USD'),
       ('c1200000-0000-4000-8000-000000000002', 'Foreign workspace', 'foreign-import-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001', 'manager'),
       ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000002', 'viewer'),
       ('c1200000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000003', 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.crm_import_jobs (workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows, row_errors)
    values ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001', 'leads', 'completed_with_errors', 3, 2, 1, '[{"row": 4, "errors": ["Invalid email"]}]')$$,
  'a manager can record a workspace import summary with row-numbered errors'
);
select is((select count(*)::integer from public.crm_import_jobs where workspace_id = 'c1200000-0000-4000-8000-000000000001'), 1, 'import summary is visible in its workspace');
select is((select count(*)::integer from public.crm_import_jobs where workspace_id = 'c1200000-0000-4000-8000-000000000002'), 0, 'workspace member cannot read a foreign import summary');
select throws_ok(
  $$insert into public.crm_import_jobs (workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows)
    values ('c1200000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000001', 'leads', 'completed', 1, 1, 0)$$,
  '42501', null, 'member cannot write import history to another workspace'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.crm_import_jobs (workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows)
    values ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000002', 'contacts', 'completed', 1, 1, 0)$$,
  '42501', null, 'viewer cannot create an import job'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.crm_import_jobs (workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows)
    values ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001', 'contacts', 'completed', 2, 1, 0)$$,
  '23514', null, 'import summary counts must account for every row'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into public.crm_import_jobs (workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows)
    values ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000003', 'companies', 'completed', 1, 1, 0)$$,
  '42501', null, 'foreign workspace member cannot create a job for another workspace'
);
reset role;
select is((select row_errors #>> '{0,row}' from public.crm_import_jobs where workspace_id = 'c1200000-0000-4000-8000-000000000001' and created_by = 'c1100000-0000-4000-8000-000000000001'), '4', 'history contains row numbers and errors rather than imported raw data');
select * from finish();
rollback;
