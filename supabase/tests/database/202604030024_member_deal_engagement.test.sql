begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deal-engagement-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'deal-engagement-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'deal-engagement-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'deal-engagement-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'deal-engagement-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency) values
  ('e1200000-0000-4000-8000-000000000001', 'Deal Engagement Workspace', 'deal-engagement-workspace', 'USD'),
  ('e1200000-0000-4000-8000-000000000002', 'Foreign Deal Engagement Workspace', 'foreign-deal-engagement-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'member'),
  ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000002', 'member'),
  ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000003', 'viewer'),
  ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000004', 'admin'),
  ('e1200000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000005', 'member');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, fixture.currency, fixture.owner_id, fixture.owner_id
from (values
  ('e1300000-0000-4000-8000-000000000001'::uuid, 'e1200000-0000-4000-8000-000000000001'::uuid, 'Owned deal', 'USD', 'e1100000-0000-4000-8000-000000000001'::uuid),
  ('e1300000-0000-4000-8000-000000000002'::uuid, 'e1200000-0000-4000-8000-000000000001'::uuid, 'Peer deal', 'USD', 'e1100000-0000-4000-8000-000000000002'::uuid),
  ('e1300000-0000-4000-8000-000000000003'::uuid, 'e1200000-0000-4000-8000-000000000001'::uuid, 'Viewer deal', 'USD', 'e1100000-0000-4000-8000-000000000003'::uuid),
  ('e1300000-0000-4000-8000-000000000004'::uuid, 'e1200000-0000-4000-8000-000000000002'::uuid, 'Foreign deal', 'EUR', 'e1100000-0000-4000-8000-000000000005'::uuid)
) as fixture(id, workspace_id, title, currency, owner_id)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

insert into public.notes (id, workspace_id, body, created_by, related_entity_type, related_entity_id) values
  ('e1400000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'Peer deal note', 'e1100000-0000-4000-8000-000000000002', 'deal', 'e1300000-0000-4000-8000-000000000002'),
  ('e1400000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000002', 'Foreign deal note', 'e1100000-0000-4000-8000-000000000005', 'deal', 'e1300000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'Send proposal', 'follow_up', 'medium', 'deal', 'e1300000-0000-4000-8000-000000000001')$$,
  'member can create a self-assigned follow-up task for an owned deal'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'Pricing details', 'e1100000-0000-4000-8000-000000000001', 'deal', 'e1300000-0000-4000-8000-000000000001')$$,
  'member can add a note to an owned deal'
);
select lives_ok($$update public.notes set is_pinned = true where related_entity_type = 'deal' and related_entity_id = 'e1300000-0000-4000-8000-000000000001'$$, 'member can pin their own note on an owned deal');
update public.notes set is_pinned = true where id = 'e1400000-0000-4000-8000-000000000001';
select is((select is_pinned from public.notes where id = 'e1400000-0000-4000-8000-000000000001'), false, 'member cannot pin a note on a peer-owned deal');
update public.notes set is_pinned = true where id = 'e1400000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.notes where id = 'e1400000-0000-4000-8000-000000000002'), 0, 'member cannot pin a note across workspaces');
select is((select count(*)::integer from public.tasks where related_entity_type = 'deal' and related_entity_id = 'e1300000-0000-4000-8000-000000000001'), 1, 'workspace member can read the related task');
select is((select count(*)::integer from public.notes where related_entity_type = 'deal' and related_entity_id = 'e1300000-0000-4000-8000-000000000001'), 1, 'workspace member can read the related note');
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'Peer task', 'follow_up', 'medium', 'deal', 'e1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot create a task for a peer deal'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'Peer note', 'e1100000-0000-4000-8000-000000000001', 'deal', 'e1300000-0000-4000-8000-000000000002')$$,
  '42501', null, 'member cannot add a note to a peer deal'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000002', 'Foreign note', 'e1100000-0000-4000-8000-000000000001', 'deal', 'e1300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'member cannot add a note across workspaces'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'Mismatched task', 'follow_up', 'medium', 'deal', 'e1300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'deal target validation prevents mismatched workspace references'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id, is_system_event)
    values ('e1200000-0000-4000-8000-000000000001', 'call', 'Spoofed activity', 'e1100000-0000-4000-8000-000000000001', 'deal', 'e1300000-0000-4000-8000-000000000001', true)$$,
  '42501', null, 'member cannot insert system activity through engagement'
);

select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000003', 'e1100000-0000-4000-8000-000000000003', 'Viewer task', 'follow_up', 'medium', 'deal', 'e1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'viewer cannot create a follow-up task'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'Viewer note', 'e1100000-0000-4000-8000-000000000003', 'deal', 'e1300000-0000-4000-8000-000000000003')$$,
  '42501', null, 'viewer cannot add a note'
);
select is((select count(*)::integer from public.notes where related_entity_id = 'e1300000-0000-4000-8000-000000000001'), 1, 'viewer can read workspace notes');

select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, title, task_type, priority, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000004', 'Admin task', 'follow_up', 'medium', 'deal', 'e1300000-0000-4000-8000-000000000002')$$,
  'admin retains existing task insertion behavior'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('e1200000-0000-4000-8000-000000000001', 'Admin note', 'e1100000-0000-4000-8000-000000000004', 'deal', 'e1300000-0000-4000-8000-000000000002')$$,
  'admin retains existing note insertion behavior'
);
select lives_ok($$update public.notes set is_pinned = true where id = 'e1400000-0000-4000-8000-000000000001'$$, 'admin retains pin update access to peer-owned deal notes');

select * from finish();
rollback;
