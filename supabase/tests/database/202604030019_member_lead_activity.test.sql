begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lead-audit-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'lead-audit-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'lead-audit-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'lead-audit-foreign@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'lead-audit-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('c1100000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'lead-audit-admin@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('c1200000-0000-4000-8000-000000000001', 'Lead Audit Workspace', 'lead-audit-workspace', 'USD'),
  ('c1200000-0000-4000-8000-000000000002', 'Foreign Lead Audit Workspace', 'foreign-lead-audit-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001', 'member'),
  ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000002', 'member'),
  ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000003', 'viewer'),
  ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000005', 'manager'),
  ('c1200000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000006', 'admin'),
  ('c1200000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000004', 'member');

insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by)
values
  ('c1300000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001', 'Owned lead', 'USD', 'c1100000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001'),
  ('c1300000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001', 'Peer lead', 'USD', 'c1100000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000002'),
  ('c1300000-0000-4000-8000-000000000003', 'c1200000-0000-4000-8000-000000000001', 'Unowned lead', 'USD', null, 'c1100000-0000-4000-8000-000000000005'),
  ('c1300000-0000-4000-8000-000000000004', 'c1200000-0000-4000-8000-000000000002', 'Foreign lead', 'EUR', 'c1100000-0000-4000-8000-000000000004', 'c1100000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, owner_id, related_entity_type, related_entity_id, is_system_event)
    values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'Lead created', 'c1100000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001', 'lead', 'c1300000-0000-4000-8000-000000000001', false)$$,
  'member can append a self-created non-system event to a lead they own'
);
select is((select count(*)::integer from public.activities where related_entity_type = 'lead'), 1, 'owned lead event is persisted');
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id, is_system_event) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000001', 'lead', 'c1300000-0000-4000-8000-000000000001', true)$$,
  '42501', null, 'member cannot insert a system event for an owned lead'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000002', 'lead', 'c1300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'member cannot create an event as another user'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000001', 'lead', 'c1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot append to a lead owned by another member'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000001', 'lead', 'c1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'member cannot append to an unowned lead'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000003', 'lead', 'c1300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'viewer cannot append to an owned lead'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000002', 'record_created', 'c1100000-0000-4000-8000-000000000001', 'lead', 'c1300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'member cannot append to a foreign-workspace lead'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000005', true);
select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000005', 'lead', 'c1300000-0000-4000-8000-000000000002')$$,
  'manager retains the existing lead activity policy behavior'
);
select set_config('request.jwt.claim.sub', 'c1100000-0000-4000-8000-000000000006', true);
select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, created_by, related_entity_type, related_entity_id) values ('c1200000-0000-4000-8000-000000000001', 'record_created', 'c1100000-0000-4000-8000-000000000006', 'lead', 'c1300000-0000-4000-8000-000000000002')$$,
  'admin retains the existing lead activity policy behavior'
);

select * from finish();
rollback;
