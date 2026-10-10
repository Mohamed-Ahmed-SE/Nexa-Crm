begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'stage-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('f1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'stage-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('f1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'stage-foreign-admin@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('f1200000-0000-4000-8000-000000000001', 'Stage Settings Workspace', 'stage-settings-workspace', 'USD'),
  ('f1200000-0000-4000-8000-000000000002', 'Foreign Stage Workspace', 'foreign-stage-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('f1200000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'admin'),
  ('f1200000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000002', 'member'),
  ('f1200000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000003', 'admin');

update public.pipeline_stages
set is_active = false
where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Proposal';

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, created_by)
select 'f1300000-0000-4000-8000-000000000001', p.workspace_id, p.id, ps.id, 'Stage association stays fixed', 100, 'USD', 'f1100000-0000-4000-8000-000000000001'
from public.pipelines p
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery'
where p.workspace_id = 'f1200000-0000-4000-8000-000000000001' and p.is_default;
select set_config(
  'test.foreign_discovery_stage_id',
  (select id::text from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000002' and name = 'Discovery'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.rename_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Discovery'), '  Prospecting  ')$$,
  'admin can rename an active open stage'
);
select is(
  (select name from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Prospecting'),
  'Prospecting', 'rename trims the stage name'
);
select throws_ok(
  $$select public.rename_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Prospecting'), 'Qualified')$$,
  '23505', null, 'duplicate names are rejected'
);
select throws_ok(
  $$select public.rename_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and stage_type = 'won'), 'Closed')$$,
  '22023', null, 'terminal stages cannot be renamed'
);
select throws_ok(
  $$select public.rename_pipeline_stage(current_setting('test.foreign_discovery_stage_id')::uuid, 'Foreign edit')$$,
  '42501', null, 'workspace membership is derived from the stage workspace'
);
select lives_ok(
  $$select public.reorder_pipeline_stages(
    (select id from public.pipelines where workspace_id = 'f1200000-0000-4000-8000-000000000001' and is_default),
    array[
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Negotiation'),
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Prospecting'),
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Qualified')
    ])$$,
  'admin can atomically reorder exactly the active open stages'
);
select is(
  (select pg_catalog.string_agg(name || ':' || position::text, ',' order by position)
   from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001'),
  'Negotiation:1,Prospecting:2,Proposal:3,Qualified:4,Won:5,Lost:6',
  'reorder swaps unique positions while preserving inactive and terminal slots'
);
select throws_ok(
  $$select public.reorder_pipeline_stages(
    (select id from public.pipelines where workspace_id = 'f1200000-0000-4000-8000-000000000001' and is_default),
    array[(select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Negotiation')])$$,
  '22023', null, 'partial stage sets are rejected'
);
select is(
  (select count(*)::integer from public.deals d
   join public.pipeline_stages ps on ps.id = d.stage_id and ps.workspace_id = d.workspace_id
   where d.id = 'f1300000-0000-4000-8000-000000000001' and ps.name = 'Prospecting' and d.status = 'open'),
  1, 'reordering and renaming preserve the deal stage association and state'
);

select set_config('request.jwt.claim.sub', 'f1100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.rename_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Qualified'), 'Member edit')$$,
  '42501', null, 'non-admin members cannot rename stages'
);
select throws_ok(
  $$select public.reorder_pipeline_stages(
    (select id from public.pipelines where workspace_id = 'f1200000-0000-4000-8000-000000000001' and is_default),
    array[
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Negotiation'),
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Prospecting'),
      (select id from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and name = 'Qualified')
    ])$$,
  '42501', null, 'non-admin members cannot reorder stages'
);

reset role;
select is(
  (select count(*)::integer from public.pipeline_stages where workspace_id = 'f1200000-0000-4000-8000-000000000001' and stage_type in ('won', 'lost') and is_active),
  2, 'terminal stages remain active and unchanged'
);
select * from finish();
rollback;
