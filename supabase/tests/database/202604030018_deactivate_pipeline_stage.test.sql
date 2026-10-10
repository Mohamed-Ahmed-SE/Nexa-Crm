begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deactivate-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('f2100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'deactivate-member@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values ('f2200000-0000-4000-8000-000000000001', 'Stage Deactivation Workspace', 'stage-deactivation-workspace', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('f2200000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000001', 'admin'),
  ('f2200000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000002', 'member');

insert into public.pipeline_stages (id, workspace_id, pipeline_id, name, position, probability, stage_type, is_active)
select stages.id, p.workspace_id, p.id, stages.name, stages.position, 30, stages.stage_type, true
from public.pipelines p
cross join (values
  ('f2300000-0000-4000-8000-000000000001'::uuid, 'Empty open stage', 7, 'open'),
  ('f2300000-0000-4000-8000-000000000002'::uuid, 'Open deal stage', 8, 'open'),
  ('f2300000-0000-4000-8000-000000000003'::uuid, 'Closed history stage', 9, 'open'),
  ('f2300000-0000-4000-8000-000000000004'::uuid, 'Move source stage', 10, 'open')
) as stages(id, name, position, stage_type)
where p.workspace_id = 'f2200000-0000-4000-8000-000000000001' and p.is_default;

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, currency, created_by, archived_at)
select 'f2400000-0000-4000-8000-000000000001', p.workspace_id, p.id, 'f2300000-0000-4000-8000-000000000002', 'Archived open deal', 'USD', 'f2100000-0000-4000-8000-000000000001', now()
from public.pipelines p
where p.workspace_id = 'f2200000-0000-4000-8000-000000000001' and p.is_default;

alter table public.deals disable trigger deals_sync_stage_state;
insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, currency, created_by)
select 'f2400000-0000-4000-8000-000000000002', p.workspace_id, p.id, 'f2300000-0000-4000-8000-000000000003', 'Closed historical deal', 'USD', 'f2100000-0000-4000-8000-000000000001'
from public.pipelines p
where p.workspace_id = 'f2200000-0000-4000-8000-000000000001' and p.is_default;
update public.deals set status = 'won', won_at = now()
where id = 'f2400000-0000-4000-8000-000000000002';
alter table public.deals enable trigger deals_sync_stage_state;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.deactivate_pipeline_stage('f2300000-0000-4000-8000-000000000001')$$,
  'admin can disable an empty active open stage'
);
select throws_ok(
  $$select public.deactivate_pipeline_stage('f2300000-0000-4000-8000-000000000002')$$,
  'PST01', null, 'archived open deals still block deactivation'
);
select lives_ok(
  $$select public.deactivate_pipeline_stage('f2300000-0000-4000-8000-000000000003')$$,
  'closed historical references do not block deactivation'
);
select lives_ok(
  $$update public.deals set title = 'Preserved closed history' where id = 'f2400000-0000-4000-8000-000000000002'$$,
  'a closed historical deal can still be updated in place'
);
select is(
  (select status from public.deals where id = 'f2400000-0000-4000-8000-000000000002'),
  'won', 'updating closed history does not reopen its deal'
);
select throws_ok(
  $$select public.deactivate_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f2200000-0000-4000-8000-000000000001' and stage_type = 'won'))$$,
  '22023', null, 'Won stage cannot be disabled'
);
select throws_ok(
  $$select public.deactivate_pipeline_stage((select id from public.pipeline_stages where workspace_id = 'f2200000-0000-4000-8000-000000000001' and stage_type = 'lost'))$$,
  '22023', null, 'Lost stage cannot be disabled'
);
select throws_ok(
  $$update public.pipeline_stages set is_active = false where id = 'f2300000-0000-4000-8000-000000000004'$$,
  '42501', null, 'authenticated users cannot bypass the safe deactivation RPC'
);
select throws_ok(
  $$insert into public.deals (workspace_id, pipeline_id, stage_id, title, currency, created_by)
    select p.workspace_id, p.id, 'f2300000-0000-4000-8000-000000000001', 'Invalid new assignment', 'USD', 'f2100000-0000-4000-8000-000000000001'
    from public.pipelines p where p.workspace_id = 'f2200000-0000-4000-8000-000000000001' and p.is_default$$,
  'PST02', null, 'new deals cannot target an inactive open stage'
);
select throws_ok(
  $$update public.deals set stage_id = 'f2300000-0000-4000-8000-000000000001'
    where id = 'f2400000-0000-4000-8000-000000000002'$$,
  'PST02', null, 'deals cannot move to an inactive open stage'
);
select set_config('request.jwt.claim.sub', 'f2100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.deactivate_pipeline_stage('f2300000-0000-4000-8000-000000000004')$$,
  '42501', null, 'non-admin member cannot disable an active open stage'
);

select * from finish();
rollback;
