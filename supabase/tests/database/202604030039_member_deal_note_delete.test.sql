begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e5100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deal-note-delete-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('e5100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'deal-note-delete-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e5100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'deal-note-delete-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e5100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'deal-note-delete-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('e5100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'deal-note-delete-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency) values
  ('e5200000-0000-4000-8000-000000000001', 'Deal Note Delete Workspace', 'deal-note-delete-workspace', 'USD'),
  ('e5200000-0000-4000-8000-000000000002', 'Foreign Deal Note Delete Workspace', 'foreign-deal-note-delete-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('e5200000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000001', 'member'),
  ('e5200000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000002', 'member'),
  ('e5200000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000003', 'viewer'),
  ('e5200000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000004', 'admin'),
  ('e5200000-0000-4000-8000-000000000002', 'e5100000-0000-4000-8000-000000000005', 'member');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by, archived_at)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, fixture.currency, fixture.owner_id, fixture.owner_id, fixture.archived_at
from (values
  ('e5300000-0000-4000-8000-000000000001'::uuid, 'e5200000-0000-4000-8000-000000000001'::uuid, 'Owned deal', 'USD', 'e5100000-0000-4000-8000-000000000001'::uuid, null::timestamptz),
  ('e5300000-0000-4000-8000-000000000002'::uuid, 'e5200000-0000-4000-8000-000000000001'::uuid, 'Peer deal', 'USD', 'e5100000-0000-4000-8000-000000000002'::uuid, null::timestamptz),
  ('e5300000-0000-4000-8000-000000000003'::uuid, 'e5200000-0000-4000-8000-000000000001'::uuid, 'Archived owned deal', 'USD', 'e5100000-0000-4000-8000-000000000001'::uuid, now()),
  ('e5300000-0000-4000-8000-000000000004'::uuid, 'e5200000-0000-4000-8000-000000000002'::uuid, 'Foreign deal', 'EUR', 'e5100000-0000-4000-8000-000000000005'::uuid, null::timestamptz)
) as fixture(id, workspace_id, title, currency, owner_id, archived_at)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

insert into public.notes (id, workspace_id, body, created_by, related_entity_type, related_entity_id) values
  ('e5400000-0000-4000-8000-000000000001', 'e5200000-0000-4000-8000-000000000001', 'Member note on owned deal', 'e5100000-0000-4000-8000-000000000001', 'deal', 'e5300000-0000-4000-8000-000000000001'),
  ('e5400000-0000-4000-8000-000000000002', 'e5200000-0000-4000-8000-000000000001', 'Peer note on owned deal', 'e5100000-0000-4000-8000-000000000002', 'deal', 'e5300000-0000-4000-8000-000000000001'),
  ('e5400000-0000-4000-8000-000000000003', 'e5200000-0000-4000-8000-000000000001', 'Member note on peer deal', 'e5100000-0000-4000-8000-000000000001', 'deal', 'e5300000-0000-4000-8000-000000000002'),
  ('e5400000-0000-4000-8000-000000000004', 'e5200000-0000-4000-8000-000000000001', 'Member note on archived deal', 'e5100000-0000-4000-8000-000000000001', 'deal', 'e5300000-0000-4000-8000-000000000003'),
  ('e5400000-0000-4000-8000-000000000005', 'e5200000-0000-4000-8000-000000000002', 'Foreign deal note', 'e5100000-0000-4000-8000-000000000005', 'deal', 'e5300000-0000-4000-8000-000000000004'),
  ('e5400000-0000-4000-8000-000000000006', 'e5200000-0000-4000-8000-000000000001', 'Peer note for admin delete', 'e5100000-0000-4000-8000-000000000002', 'deal', 'e5300000-0000-4000-8000-000000000002'),
  ('e5400000-0000-4000-8000-000000000007', 'e5200000-0000-4000-8000-000000000001', 'Member note guarded from viewer', 'e5100000-0000-4000-8000-000000000001', 'deal', 'e5300000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e5100000-0000-4000-8000-000000000001', true);
select lives_ok($$delete from public.notes where id = 'e5400000-0000-4000-8000-000000000001'$$, 'member can run a delete for their own note on an owned deal');
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000001'), 0, 'member deleted their own note on an owned deal');
delete from public.notes where id = 'e5400000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000002'), 1, 'member cannot delete another creator’s note on an owned deal');
delete from public.notes where id = 'e5400000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000003'), 1, 'member cannot delete a note on a peer-owned deal');
delete from public.notes where id = 'e5400000-0000-4000-8000-000000000004';
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000004'), 1, 'member cannot delete a note on an archived deal');

select set_config('request.jwt.claim.sub', 'e5100000-0000-4000-8000-000000000003', true);
delete from public.notes where id = 'e5400000-0000-4000-8000-000000000007';
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000007'), 1, 'viewer cannot delete a deal note');

select set_config('request.jwt.claim.sub', 'e5100000-0000-4000-8000-000000000005', true);
delete from public.notes where id in ('e5400000-0000-4000-8000-000000000005', 'e5400000-0000-4000-8000-000000000007');

select set_config('request.jwt.claim.sub', 'e5100000-0000-4000-8000-000000000004', true);
select lives_ok($$delete from public.notes where id = 'e5400000-0000-4000-8000-000000000006'$$, 'admin can run a delete for a peer note on a peer-owned deal');
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000006'), 0, 'admin retains delete access to deal notes created by others');

reset role;
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000005'), 1, 'member cannot delete a deal note across workspaces');
select is((select count(*)::integer from public.notes where id = 'e5400000-0000-4000-8000-000000000007'), 1, 'member of another workspace cannot delete a deal note in this workspace');

select * from finish();
rollback;
