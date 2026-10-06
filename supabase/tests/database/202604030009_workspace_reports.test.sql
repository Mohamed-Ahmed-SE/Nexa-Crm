begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'report-owner@example.test', '', now(), '{}', '{"full_name":"Report Owner"}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'report-outsider@example.test', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'report-teammate@example.test', '', now(), '{}', '{"full_name":"Alex Teammate"}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('92000000-0000-4000-8000-000000000001', 'Report Workspace', 'report-workspace', 'USD'),
       ('92000000-0000-4000-8000-000000000002', 'Other Report Workspace', 'other-report-workspace', 'EUR');
insert into public.workspace_members (workspace_id, user_id, role)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'manager'),
       ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'member'),
       ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'viewer');

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

insert into public.activities (workspace_id, activity_type, subject, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, is_system_event)
values
  ('92000000-0000-4000-8000-000000000001', 'call', 'Human call', '2025-04-10T12:00:00Z', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'deal', '93000000-0000-4000-8000-000000000001', false),
  ('92000000-0000-4000-8000-000000000001', 'call', 'Teammate call', '2025-04-10T13:00:00Z', '91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', 'deal', '93000000-0000-4000-8000-000000000003', false),
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
  'Alex Teammate', 'activity report resolves teammate display names');
select is(public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')->'top_deals'->0->>'owner', 'Alex Teammate', 'deal table report resolves teammate display names');
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select is((select display_name from public.get_workspace_report_member_labels('92000000-0000-4000-8000-000000000001') where user_id = '91000000-0000-4000-8000-000000000001'), 'Report Owner', 'workspace viewer can read teammate labels');
select throws_ok($$select * from public.get_workspace_report_member_labels('92000000-0000-4000-8000-000000000002')$$, '42501', null, 'workspace viewer cannot read member labels from another workspace');
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.get_workspace_report('92000000-0000-4000-8000-000000000002', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z')$$, '42501', null, 'workspace members cannot query another workspace');
select throws_ok($$select public.get_workspace_report('92000000-0000-4000-8000-000000000001', '2025-04-01T00:00:00Z', '2025-05-01T00:00:00Z', '91000000-0000-4000-8000-000000000002')$$, '22023', null, 'owner filters cannot reference users outside the workspace');
select * from finish();
rollback;
