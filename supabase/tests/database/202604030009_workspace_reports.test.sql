begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'report-owner@example.test', '', now(), '{}', '{"full_name":"Report Owner"}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'report-outsider@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'report-teammate@example.test', '', now(), '{}', '{"full_name":"Alex Teammate"}', now(), now()),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'report-teammate-two@example.test', '', now(), '{}', '{"full_name":"Alex Teammate"}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('92000000-0000-4000-8000-000000000001', 'Report Workspace', 'report-workspace', 'USD'),
       ('92000000-0000-4000-8000-000000000002', 'Other Report Workspace', 'other-report-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'manager'),
       ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'member'),
       ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'viewer'),
       ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'member');

insert into public.pipelines (id, workspace_id, name, is_default)
values ('97000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Growth', false);
insert into public.pipeline_stages (id, workspace_id, pipeline_id, name, position, probability, stage_type)
values ('97000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000002', 'Discovery', 1, 20, 'open');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, status, created_by, created_at, won_at, lost_at)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, fixture.amount, fixture.currency,
  fixture.owner_id, fixture.status, fixture.owner_id, fixture.created_at, fixture.won_at, fixture.lost_at
from (values
  ('93000000-0000-4000-8000-000000000001'::uuid, '92000000-0000-4000-8000-000000000001'::uuid, 'Won in range', 100::numeric, 'USD', '91000000-0000-4000-8000-000000000001'::uuid, 'won', '2025-03-15T00:00:00Z'::timestamptz, '2025-04-30T23:59:59Z'::timestamptz, null::timestamptz, 'Won'::text),
  ('93000000-0000-4000-8000-000000000002'::uuid, '92000000-0000-4000-8000-000000000001'::uuid, 'Lost in range', 50::numeric, 'USD', '91000000-0000-4000-8000-000000000001'::uuid, 'lost', '2025-04-01T00:00:00Z'::timestamptz, null::timestamptz, '2025-04-25T12:00:00Z'::timestamptz, 'Lost'::text),
  ('93000000-0000-4000-8000-000000000003'::uuid, '92000000-0000-4000-8000-000000000001'::uuid, 'Open in range', 300::numeric, 'USD', '91000000-0000-4000-8000-000000000003'::uuid, 'open', '2025-04-20T00:00:00Z'::timestamptz, null::timestamptz, null::timestamptz, 'Discovery'::text),
  ('93000000-0000-4000-8000-000000000004'::uuid, '92000000-0000-4000-8000-000000000001'::uuid, 'Other currency', 999::numeric, 'EUR', '91000000-0000-4000-8000-000000000001'::uuid, 'open', '2025-04-20T00:00:00Z'::timestamptz, null::timestamptz, null::timestamptz, 'Discovery'::text),
  ('93000000-0000-4000-8000-000000000005'::uuid, '92000000-0000-4000-8000-000000000001'::uuid, 'Upper boundary', 700::numeric, 'USD', '91000000-0000-4000-8000-000000000001'::uuid, 'open', '2025-05-01T00:00:00Z'::timestamptz, null::timestamptz, null::timestamptz, 'Discovery'::text)
) as fixture(id, workspace_id, title, amount, currency, owner_id, status, created_at, won_at, lost_at, stage_name)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = fixture.stage_name;
insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, status, created_by, created_at)
select '93000000-0000-4000-8000-000000000006', p.workspace_id, p.id, ps.id, 'Growth deal', 400, 'USD',
  '91000000-0000-4000-8000-000000000004', 'open', '91000000-0000-4000-8000-000000000004', '2025-03-20T00:00:00Z'
from public.pipelines p
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id
where p.id = '97000000-0000-4000-8000-000000000002' and ps.id = '97000000-0000-4000-8000-000000000003';
insert into public.activities (workspace_id, activity_type, subject, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event)
select d.workspace_id, 'stage_changed', 'Fixture stage entry', fixture.occurred_at, d.created_by, d.owner_id, 'deal', d.id,
  case when fixture.has_stage_metadata then jsonb_build_object('to_stage_id', d.stage_id) else '{}'::jsonb end, false
from (values
  ('93000000-0000-4000-8000-000000000001'::uuid, '2025-04-01T00:00:00Z'::timestamptz, true),
  ('93000000-0000-4000-8000-000000000002'::uuid, '2025-04-30T23:59:59Z'::timestamptz, true),
  ('93000000-0000-4000-8000-000000000003'::uuid, '2025-04-15T12:00:00Z'::timestamptz, true),
  ('93000000-0000-4000-8000-000000000004'::uuid, '2025-04-15T12:00:00Z'::timestamptz, false),
  ('93000000-0000-4000-8000-000000000005'::uuid, '2025-05-01T00:00:00Z'::timestamptz, true),
  ('93000000-0000-4000-8000-000000000006'::uuid, '2025-04-15T12:00:00Z'::timestamptz, true)
) as fixture(deal_id, occurred_at, has_stage_metadata)
join public.deals d on d.id = fixture.deal_id;

insert into public.leads (id, workspace_id, full_name, source_id, owner_id, estimated_value, currency, created_by, created_at)
values
  ('96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Boundary Lead', (select id from public.lead_sources where workspace_id = '92000000-0000-4000-8000-000000000001' and name = 'Referral'), '91000000-0000-4000-8000-000000000001', 100, 'USD', '91000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z'),
  ('96000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'In Range Lead', (select id from public.lead_sources where workspace_id = '92000000-0000-4000-8000-000000000001' and name = 'Referral'), '91000000-0000-4000-8000-000000000001', 75, 'USD', '91000000-0000-4000-8000-000000000001', '2025-04-30T23:59:59Z'),
  ('96000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', 'Upper Lead', (select id from public.lead_sources where workspace_id = '92000000-0000-4000-8000-000000000001' and name = 'Referral'), '91000000-0000-4000-8000-000000000001', 900, 'USD', '91000000-0000-4000-8000-000000000001', '2025-05-01T00:00:00Z'),
  ('96000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001', 'Teammate Lead', (select id from public.lead_sources where workspace_id = '92000000-0000-4000-8000-000000000001' and name = 'Referral'), '91000000-0000-4000-8000-000000000003', 500, 'USD', '91000000-0000-4000-8000-000000000003', '2025-04-15T00:00:00Z'),
  ('96000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000001', 'Other Currency Lead', (select id from public.lead_sources where workspace_id = '92000000-0000-4000-8000-000000000001' and name = 'Referral'), '91000000-0000-4000-8000-000000000001', 700, 'EUR', '91000000-0000-4000-8000-000000000001', '2025-04-15T00:00:00Z');
insert into public.tasks (workspace_id, title, status, due_at, assigned_to, created_by, related_entity_type, related_entity_id, completed_at)
values
  ('92000000-0000-4000-8000-000000000001', 'Completed boundary', 'completed', '2025-04-01T00:00:00Z', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z'),
  ('92000000-0000-4000-8000-000000000001', 'Completed upper boundary', 'completed', '2025-04-01T00:00:00Z', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', '2025-05-01T00:00:00Z'),
  ('92000000-0000-4000-8000-000000000001', 'Overdue deal task', 'open', now() - interval '1 day', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', null),
  ('92000000-0000-4000-8000-000000000001', 'Overdue unlinked task', 'open', now() - interval '1 day', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', null, null, null);

insert into public.activities (workspace_id, activity_type, subject, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, is_system_event)
values
  ('92000000-0000-4000-8000-000000000001', 'call', 'Human call', '2025-04-10T12:00:00Z', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', false),
  ('92000000-0000-4000-8000-000000000001', 'call', 'Teammate call', '2025-04-10T13:00:00Z', '91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', 'deal', '93000000-0000-4000-8000-000000000003', false),
  ('92000000-0000-4000-8000-000000000001', 'call', 'Second teammate call', '2025-04-10T14:00:00Z', '91000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000004', 'deal', '93000000-0000-4000-8000-000000000006', false),
  ('92000000-0000-4000-8000-000000000001', 'stage_change', 'System stage event', '2025-04-11T12:00:00Z', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', true);

select ok(not has_function_privilege('anon', 'public.get_workspace_report(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid)', 'EXECUTE'), 'anonymous users cannot execute report RPC');
select ok(not has_function_privilege('anon', 'public.get_workspace_report_member_labels(uuid)', 'EXECUTE'), 'anonymous users cannot execute member-label RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'summary'->>'total_deals')::integer, 2, 'creation range is lower-inclusive and upper-exclusive');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'summary'->>'won_revenue')::numeric, 100::numeric, 'won revenue uses won_at and workspace default currency');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'summary'->>'average_deal_value')::numeric, 175::numeric, 'average deal value uses only default-currency created deals');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'activity_by_rep'->0->>'activities')::integer, 1, 'system activities are excluded from human activity counts');
select is(
  (select value->>'name' from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'activity_by_rep') as rep(value) where value->>'owner_id' = '91000000-0000-4000-8000-000000000003'),
  'Alex Teammate · #00000003', 'activity report disambiguates duplicate teammate display names');
select is(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'top_deals'->0->>'owner', 'Alex Teammate · #00000003', 'deal table report disambiguates duplicate teammate display names');
select is(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000003')->'pipeline_by_owner'->0->>'owner', 'Alex Teammate · #00000003', 'pipeline value is grouped by selected deal owner');
select is(
  (select row->>'owner' from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'pipeline_by_owner') row where row->>'owner_id' = '91000000-0000-4000-8000-000000000004'),
  'Alex Teammate · #00000004', 'pipeline owner rows retain stable IDs and distinguish duplicate names');
select is(
  (select concat(row->>'pipeline', ' · ', row->>'name') from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'pipeline_by_stage') row where row->>'pipeline_id' = '97000000-0000-4000-8000-000000000002'),
  'Growth · Discovery', 'same-named stages retain their pipeline label and identity');
select is(
  (select row->>'name' from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'activity_by_rep') row where row->>'owner_id' = '91000000-0000-4000-8000-000000000004'),
  'Alex Teammate · #00000004', 'activity rows distinguish duplicate teammate display names');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000003', (select id from public.pipelines where workspace_id = '92000000-0000-4000-8000-000000000001' and is_default))->'pipeline_by_owner'->0->>'amount')::numeric, 300::numeric, 'pipeline owner value respects owner and pipeline filters');
select is((select row->>'leads' from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000001')->'lead_source_performance') row where row->>'name' = 'Referral')::integer, 2, 'lead-source counts include lower boundary and exclude upper boundary while applying owner and currency');
select is((select row->>'estimated_value' from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000001')->'lead_source_performance') row where row->>'name' = 'Referral')::numeric, 175::numeric, 'lead-source estimated value uses workspace-default currency');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000001', (select id from public.pipelines where workspace_id = '92000000-0000-4000-8000-000000000001' and is_default))->'tasks'->>'completed')::integer, 1, 'task completions use completed_at lower-inclusive and upper-exclusive dates and pipeline deal scope');
select is((public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000001', (select id from public.pipelines where workspace_id = '92000000-0000-4000-8000-000000000001' and is_default))->'tasks'->>'overdue')::integer, 1, 'overdue tasks are current open assigned tasks linked to selected pipeline deals');
select is((select sum((row->>'deals')::integer) from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000001', (select id from public.pipelines where workspace_id = '92000000-0000-4000-8000-000000000001' and is_default))->'deal_conversion_funnel') row), 2::bigint, 'funnel counts lower-boundary and in-range tracked entries but excludes the upper boundary and unstructured history');
select is((select sum((row->>'deals')::integer) from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000003', (select id from public.pipelines where workspace_id = '92000000-0000-4000-8000-000000000001' and is_default))->'deal_conversion_funnel') row), 1::bigint, 'funnel applies the selected deal owner filter');
select is((select sum((row->>'deals')::integer) from jsonb_array_elements(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', null, '97000000-0000-4000-8000-000000000002')->'deal_conversion_funnel') row), 1::bigint, 'funnel applies the selected pipeline filter');
select ok((select not p.prosecdef from pg_proc p where p.oid = 'public.get_workspace_report(uuid,timestamptz,timestamptz,uuid,uuid)'::regprocedure), 'report RPC remains security invoker');
select ok((select p.proconfig @> ARRAY['search_path=""']::text[] from pg_proc p where p.oid = 'public.get_workspace_report(uuid,timestamptz,timestamptz,uuid,uuid)'::regprocedure), 'report RPC keeps an empty search_path');
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select is((select display_name from public.get_workspace_report_member_labels('92000000-0000-4000-8000-000000000001') where user_id = '91000000-0000-4000-8000-000000000001'), 'Report Owner', 'workspace viewer can read teammate labels');
select throws_ok($$select * from public.get_workspace_report_member_labels('92000000-0000-4000-8000-000000000002')$$, '42501', null, 'workspace viewer cannot read member labels from another workspace');
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.get_workspace_report('92000000-0000-4000-8000-000000000002', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')$$, '42501', null, 'workspace members cannot query another workspace');
select throws_ok($$select public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000002')$$, '22023', null, 'owner filters cannot reference users outside the workspace');
select * from finish();
rollback;
