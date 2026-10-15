begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deal-files-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('f3100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'deal-files-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('f3100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'deal-files-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('f3100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'deal-files-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('f3100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'deal-files-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('f3100000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'deal-files-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency) values
  ('f3200000-0000-4000-8000-000000000001', 'Deal Files Workspace', 'deal-files-workspace', 'USD'),
  ('f3200000-0000-4000-8000-000000000002', 'Foreign Deal Files Workspace', 'foreign-deal-files-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('f3200000-0000-4000-8000-000000000001', 'f3100000-0000-4000-8000-000000000001', 'admin'),
  ('f3200000-0000-4000-8000-000000000001', 'f3100000-0000-4000-8000-000000000002', 'member'),
  ('f3200000-0000-4000-8000-000000000001', 'f3100000-0000-4000-8000-000000000003', 'member'),
  ('f3200000-0000-4000-8000-000000000001', 'f3100000-0000-4000-8000-000000000004', 'viewer'),
  ('f3200000-0000-4000-8000-000000000001', 'f3100000-0000-4000-8000-000000000005', 'manager'),
  ('f3200000-0000-4000-8000-000000000002', 'f3100000-0000-4000-8000-000000000006', 'member');
insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, fixture.currency, fixture.owner_id, fixture.owner_id
from (values
  ('f3300000-0000-4000-8000-000000000001'::uuid, 'f3200000-0000-4000-8000-000000000001'::uuid, 'Owned deal', 'USD', 'f3100000-0000-4000-8000-000000000002'::uuid),
  ('f3300000-0000-4000-8000-000000000002'::uuid, 'f3200000-0000-4000-8000-000000000001'::uuid, 'Peer deal', 'USD', 'f3100000-0000-4000-8000-000000000003'::uuid),
  ('f3300000-0000-4000-8000-000000000003'::uuid, 'f3200000-0000-4000-8000-000000000002'::uuid, 'Foreign deal', 'EUR', 'f3100000-0000-4000-8000-000000000006'::uuid)
) as fixture(id, workspace_id, title, currency, owner_id)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

insert into public.attachments (id, workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values
  ('f3400000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000001/owned.pdf', 'owned.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000002', 'deal', 'f3300000-0000-4000-8000-000000000001'),
  ('f3400000-0000-4000-8000-000000000002', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000002/peer.pdf', 'peer.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000003', 'deal', 'f3300000-0000-4000-8000-000000000002'),
  ('f3400000-0000-4000-8000-000000000003', 'f3200000-0000-4000-8000-000000000002', 'f3200000-0000-4000-8000-000000000002/f3300000-0000-4000-8000-000000000003/f3400000-0000-4000-8000-000000000003/foreign.pdf', 'foreign.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000006', 'deal', 'f3300000-0000-4000-8000-000000000003'),
  ('f3400000-0000-4000-8000-000000000010', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000002/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000010/wrong-workspace.pdf', 'wrong-workspace.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000002', 'deal', 'f3300000-0000-4000-8000-000000000001');
insert into storage.objects (bucket_id, name) values
  ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000001/owned.pdf'),
  ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000002/peer.pdf'),
  ('deal-attachments', 'f3200000-0000-4000-8000-000000000002/f3300000-0000-4000-8000-000000000003/f3400000-0000-4000-8000-000000000003/foreign.pdf');

select ok((select not public from storage.buckets where id = 'deal-attachments'), 'deal attachment bucket is private');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'deal_attachments_%'), 3, 'deal storage has separate read, insert, and delete policies');
select ok(
  (select with_check like '%foldername%' and with_check like '%related_entity_id%' and with_check like '%a.id%' and with_check like '%filename%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'deal_attachments_insert_uploader')
  and (select with_check like '%storage_path%' and with_check like '%related_entity_id%' from pg_policies where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_deal_path_insert'),
  'insert policies bind metadata and storage objects to exact workspace, deal, attachment, and filename paths'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f3100000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'deal-attachments' and name like 'f3200000-0000-4000-8000-000000000001/%'), 2, 'workspace member can read deal files in their workspace');
select is((select count(*)::integer from storage.objects where bucket_id = 'deal-attachments' and name like 'f3200000-0000-4000-8000-000000000002/%'), 0, 'workspace member cannot read foreign-workspace objects');
select lives_ok($$insert into public.attachments (id, workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3400000-0000-4000-8000-000000000004', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000004/new.pdf', 'new.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000002', 'deal', 'f3300000-0000-4000-8000-000000000001')$$, 'member can add attachment metadata to an owned deal');
select throws_ok($$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000005/peer-upload.pdf', 'peer-upload.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000002', 'deal', 'f3300000-0000-4000-8000-000000000002')$$, '42501', null, 'member cannot add attachment metadata to a peer-owned deal');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000004/new.pdf')$$, 'member can store an object matching owned deal metadata and path');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000002/peer.pdf')$$, '42501', null, 'member cannot insert an object for a peer uploader and deal');
select throws_ok($$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000002/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000006/wrong-workspace.pdf', 'wrong-workspace.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000002', 'deal', 'f3300000-0000-4000-8000-000000000001')$$, '42501', null, 'member cannot save attachment metadata with a mismatched workspace path');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('deal-attachments', 'f3200000-0000-4000-8000-000000000002/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000010/wrong-workspace.pdf')$$, '42501', null, 'storage policy rejects object with foreign workspace folder');
delete from public.attachments where id = 'f3400000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.attachments where id = 'f3400000-0000-4000-8000-000000000002'), 1, 'member cannot delete peer-owned attachment metadata');

select set_config('request.jwt.claim.sub', 'f3100000-0000-4000-8000-000000000004', true);
select throws_ok($$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000001/f3400000-0000-4000-8000-000000000007/viewer.pdf', 'viewer.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000004', 'deal', 'f3300000-0000-4000-8000-000000000001')$$, '42501', null, 'viewer cannot add deal attachment metadata');

select set_config('request.jwt.claim.sub', 'f3100000-0000-4000-8000-000000000005', true);
select lives_ok($$insert into public.attachments (id, workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3400000-0000-4000-8000-000000000008', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000008/manager.pdf', 'manager.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000005', 'deal', 'f3300000-0000-4000-8000-000000000002')$$, 'manager can add metadata for any deal in their workspace');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000008/manager.pdf')$$, 'manager can store an object for a peer-owned deal');

select set_config('request.jwt.claim.sub', 'f3100000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into public.attachments (id, workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id) values ('f3400000-0000-4000-8000-000000000009', 'f3200000-0000-4000-8000-000000000001', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000009/admin.pdf', 'admin.pdf', 'application/pdf', 4, 'f3100000-0000-4000-8000-000000000001', 'deal', 'f3300000-0000-4000-8000-000000000002')$$, 'admin can add metadata for any deal in their workspace');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('deal-attachments', 'f3200000-0000-4000-8000-000000000001/f3300000-0000-4000-8000-000000000002/f3400000-0000-4000-8000-000000000009/admin.pdf')$$, 'admin can store an object for a peer-owned deal');

select set_config('request.jwt.claim.sub', 'f3100000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'deal-attachments' and name like 'f3200000-0000-4000-8000-000000000001/%'), 0, 'foreign workspace member cannot read local deal objects');

select * from finish();
rollback;
