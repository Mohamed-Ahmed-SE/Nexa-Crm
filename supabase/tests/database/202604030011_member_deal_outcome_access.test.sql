begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deal-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('b1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'deal-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('b1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'deal-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('b1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'deal-foreign-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('b1100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'deal-admin@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('b1200000-0000-4000-8000-000000000001', 'Deal Outcome Workspace', 'deal-outcome-workspace', 'USD'),
  ('b1200000-0000-4000-8000-000000000002', 'Foreign Deal Workspace', 'foreign-deal-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000005', 'admin'),
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000001', 'member'),
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000002', 'viewer'),
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000003', 'member'),
  ('b1200000-0000-4000-8000-000000000002', 'b1100000-0000-4000-8000-000000000004', 'member');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, fixture.currency, fixture.owner_id, fixture.created_by
from (values
  ('b1300000-0000-4000-8000-000000000001'::uuid, 'b1200000-0000-4000-8000-000000000001'::uuid, 'Owned deal', 'USD', 'b1100000-0000-4000-8000-000000000001'::uuid, 'b1100000-0000-4000-8000-000000000005'::uuid),
  ('b1300000-0000-4000-8000-000000000002'::uuid, 'b1200000-0000-4000-8000-000000000001'::uuid, 'Peer deal', 'USD', 'b1100000-0000-4000-8000-000000000003'::uuid, 'b1100000-0000-4000-8000-000000000005'::uuid),
  ('b1300000-0000-4000-8000-000000000003'::uuid, 'b1200000-0000-4000-8000-000000000002'::uuid, 'Foreign workspace deal', 'EUR', 'b1100000-0000-4000-8000-000000000004'::uuid, 'b1100000-0000-4000-8000-000000000004'::uuid)
) as fixture(id, workspace_id, title, currency, owner_id, created_by)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

insert into public.activities (id, workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
values
  ('b1500000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001', 'call', 'Owned deal history', 'b1100000-0000-4000-8000-000000000005', 'deal', 'b1300000-0000-4000-8000-000000000001'),
  ('b1500000-0000-4000-8000-000000000002', 'b1200000-0000-4000-8000-000000000001', 'call', 'Peer deal history', 'b1100000-0000-4000-8000-000000000005', 'deal', 'b1300000-0000-4000-8000-000000000002'),
  ('b1500000-0000-4000-8000-000000000003', 'b1200000-0000-4000-8000-000000000002', 'call', 'Foreign deal history', 'b1100000-0000-4000-8000-000000000004', 'deal', 'b1300000-0000-4000-8000-000000000003');

insert into public.tasks (id, workspace_id, title, assigned_to, created_by, related_entity_type, related_entity_id)
values
  ('b1400000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001', 'Owned deal task', 'b1100000-0000-4000-8000-000000000003', 'b1100000-0000-4000-8000-000000000005', 'deal', 'b1300000-0000-4000-8000-000000000001'),
  ('b1400000-0000-4000-8000-000000000002', 'b1200000-0000-4000-8000-000000000001', 'Peer deal task', 'b1100000-0000-4000-8000-000000000003', 'b1100000-0000-4000-8000-000000000005', 'deal', 'b1300000-0000-4000-8000-000000000002'),
  ('b1400000-0000-4000-8000-000000000003', 'b1200000-0000-4000-8000-000000000002', 'Foreign deal task', 'b1100000-0000-4000-8000-000000000004', 'b1100000-0000-4000-8000-000000000004', 'deal', 'b1300000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.activities (id, workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('b1500000-0000-4000-8000-000000000004', 'b1200000-0000-4000-8000-000000000001', 'deal_won', 'Member outcome activity', 'b1100000-0000-4000-8000-000000000001', 'deal', 'b1300000-0000-4000-8000-000000000001')$$,
  'member can insert activity for a deal they own'
);
select is((select count(*)::integer from public.activities where id = 'b1500000-0000-4000-8000-000000000004'), 1, 'owned deal activity is persisted');
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('b1200000-0000-4000-8000-000000000001', 'deal_lost', 'Peer outcome activity', 'b1100000-0000-4000-8000-000000000001', 'deal', 'b1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot insert activity for a deal owned by another workspace member'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('b1200000-0000-4000-8000-000000000002', 'deal_lost', 'Foreign outcome activity', 'b1100000-0000-4000-8000-000000000001', 'deal', 'b1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'member cannot insert activity in another workspace'
);
update public.tasks set status = 'completed', completed_at = now()
where id = 'b1400000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000001' and status = 'completed'),
  1, 'member can update a related task for a deal they own'
);
update public.tasks set status = 'cancelled', completed_at = null
where id = 'b1400000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000002' and status = 'cancelled'),
  0, 'member cannot update a related task for a deal owned by another member'
);
update public.tasks set status = 'cancelled', completed_at = null
where id = 'b1400000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000003' and status = 'cancelled'),
  0, 'member cannot update a related task in another workspace'
);

select set_config('request.jwt.claim.sub', 'b1100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('b1200000-0000-4000-8000-000000000001', 'deal_won', 'Viewer outcome activity', 'b1100000-0000-4000-8000-000000000002', 'deal', 'b1300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'viewer cannot insert activity for an owned deal'
);
update public.tasks set status = 'cancelled', completed_at = null
where id = 'b1400000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000001' and status = 'cancelled'),
  0, 'viewer cannot update a related task for an owned deal'
);

reset role;
select is((select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000001' and status = 'completed'), 1, 'owned deal task remains completed after viewer update attempt');
select is((select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000002' and status = 'open'), 1, 'non-owned deal task remains unchanged');
select is((select count(*)::integer from public.tasks where id = 'b1400000-0000-4000-8000-000000000003' and status = 'open'), 1, 'foreign workspace task remains unchanged');

select * from finish();
rollback;
