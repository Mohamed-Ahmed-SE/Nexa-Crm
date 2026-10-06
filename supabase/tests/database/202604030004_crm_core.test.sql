begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin-crm@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'manager-crm@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member-crm@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'viewer-crm@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'outsider-crm@example.test', '', now(), '{}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'nonmember-crm@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values
  ('42000000-0000-4000-8000-000000000001', 'CRM Test Workspace One', 'crm-test-one', 'USD'),
  ('42000000-0000-4000-8000-000000000002', 'CRM Test Workspace Two', 'crm-test-two', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'admin'),
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002', 'manager'),
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003', 'member'),
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000004', 'viewer'),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000005', 'member');

insert into public.companies (id, workspace_id, name, owner_id, created_by)
values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Member owned', '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003'),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'Manager owned', '41000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', 'Other workspace company', '41000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000005');

insert into public.lead_sources (workspace_id, name)
values ('42000000-0000-4000-8000-000000000002', 'Second workspace source');
insert into public.tags (workspace_id, name)
values ('42000000-0000-4000-8000-000000000001', 'CRM test tag');

update public.lead_sources set name = 'Website (custom)'
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Website';
delete from public.lead_sources
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Outbound';
update public.lost_reasons set name = 'Pricing reviewed'
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Price';
delete from public.lost_reasons
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Timing';
update public.pipelines set name = 'Sales motions'
where workspace_id = '42000000-0000-4000-8000-000000000002' and is_default;
update public.pipeline_stages set probability = 15
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Discovery';
update public.pipeline_stages set name = 'Closed Won'
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Won';
delete from public.pipeline_stages
where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Proposal';
select public.seed_workspace_crm_defaults('42000000-0000-4000-8000-000000000002');
select public.seed_workspace_crm_defaults('42000000-0000-4000-8000-000000000002');
select ok(
  not has_function_privilege('authenticated', 'public.seed_workspace_crm_defaults(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.seed_workspace_crm_defaults(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.seed_workspace_crm_defaults_on_insert()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.seed_workspace_crm_defaults_on_insert()', 'EXECUTE'),
  'the internal workspace seeder is not executable by client roles'
);

select ok(
  (select count(*) = 8 from public.lead_sources where workspace_id = '42000000-0000-4000-8000-000000000002')
  and exists (select 1 from public.lead_sources where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Website (custom)')
  and exists (select 1 from public.lead_sources where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Outbound'),
  're-running the existing-workspace seeder restores missing sources without duplicating or overwriting customized ones'
);
select ok(
  (select count(*) = 7 from public.lost_reasons where workspace_id = '42000000-0000-4000-8000-000000000002')
  and exists (select 1 from public.lost_reasons where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Pricing reviewed')
  and exists (select 1 from public.lost_reasons where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Timing'),
  're-running the existing-workspace seeder restores missing lost reasons and preserves customized ones'
);
select ok(
  exists (select 1 from public.pipelines where workspace_id = '42000000-0000-4000-8000-000000000002' and is_default and name = 'Sales motions')
  and exists (select 1 from public.pipeline_stages where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Discovery' and probability = 15)
  and exists (select 1 from public.pipeline_stages where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Proposal' and probability = 60)
  and exists (select 1 from public.pipeline_stages where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Closed Won' and stage_type = 'won')
  and not exists (select 1 from public.pipeline_stages where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Won'),
  'backfill restores missing default stages while retaining customized pipeline and stage values'
);

select is(
  (select count(*)::integer from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id where p.workspace_id = '42000000-0000-4000-8000-000000000001'),
  6, 'workspace creation seeds its six-stage default pipeline'
);
select is(
  (select string_agg(name || ':' || probability::text, ',' order by position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id where p.workspace_id = '42000000-0000-4000-8000-000000000001'),
  'Discovery:10,Qualified:30,Proposal:60,Negotiation:80,Won:100,Lost:0', 'default pipeline stages have documented probabilities and order'
);
select is((select count(*)::integer from public.lead_sources where workspace_id = '42000000-0000-4000-8000-000000000001'), 7, 'workspace creation seeds seven lead sources');
select is((select string_agg(name, ',' order by name) from public.lead_sources where workspace_id = '42000000-0000-4000-8000-000000000001'), 'Event,LinkedIn,Other,Outbound,Partner,Referral,Website', 'default lead sources match the specification');
select is((select count(*)::integer from public.lost_reasons where workspace_id = '42000000-0000-4000-8000-000000000001'), 7, 'workspace creation seeds seven lost reasons');
select is((select string_agg(name, ',' order by name) from public.lost_reasons where workspace_id = '42000000-0000-4000-8000-000000000001'), 'Budget unavailable,Competitor,No response,Not a fit,Other,Price,Timing', 'default lost reasons match the specification');
select is((select count(*)::integer from public.leads where workspace_id = '42000000-0000-4000-8000-000000000001'), 0, 'workspace setup does not seed customer leads');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from public.companies), 0, 'a nonmember cannot read another workspace CRM records');
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000005', true);
select is((select count(*)::integer from public.companies), 1, 'a member reads records from their workspace but not the other workspace');
insert into public.leads (workspace_id, full_name, owner_id, created_by)
values ('42000000-0000-4000-8000-000000000002', 'Currency default lead', '41000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000005');
select is((select currency from public.leads where full_name = 'Currency default lead'), 'EUR', 'new leads inherit the workspace default currency');

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.companies), 2, 'viewer may read all records in the active workspace only');
select throws_ok(
  $$insert into public.companies (workspace_id, name, owner_id, created_by) values ('42000000-0000-4000-8000-000000000001', 'Viewer insert', '41000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004')$$,
  '42501', 'new row violates row-level security policy for table "companies"', 'viewer cannot create a company'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
update public.companies set name = 'Member changed own' where id = '43000000-0000-4000-8000-000000000001';
select is((select name from public.companies where id = '43000000-0000-4000-8000-000000000001'), 'Member changed own', 'member may update an owned record');
select is((with changed as (update public.companies set name = 'Member changed other' where id = '43000000-0000-4000-8000-000000000002' returning 1) select count(*)::integer from changed), 0, 'member cannot update a record owned by another user');
insert into public.companies (workspace_id, name, owner_id, created_by)
values ('42000000-0000-4000-8000-000000000001', 'Member-created record', '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003');
select is((select count(*)::integer from public.companies where name = 'Member-created record'), 1, 'member can create a record assigned to themselves');
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
update public.companies set name = 'Manager changed record' where id = '43000000-0000-4000-8000-000000000001';
select is((select name from public.companies where id = '43000000-0000-4000-8000-000000000001'), 'Manager changed record', 'manager may update a record owned by another user');
select throws_ok(
  $$insert into public.companies (workspace_id, name, owner_id, created_by) values ('42000000-0000-4000-8000-000000000002', 'Cross workspace spoof', '41000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "companies"', 'manager cannot use a supplied workspace id without membership'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
update public.tags set name = 'Admin renamed tag'
where id = (select id from public.tags where workspace_id = '42000000-0000-4000-8000-000000000001' limit 1);
select is((select count(*)::integer from public.tags where workspace_id = '42000000-0000-4000-8000-000000000001' and name = 'Admin renamed tag'), 1, 'admin may manage workspace lookup records');
insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id)
select '42000000-0000-4000-8000-000000000001', id, 'company', '43000000-0000-4000-8000-000000000001'
from public.tags where workspace_id = '42000000-0000-4000-8000-000000000001' and name = 'Admin renamed tag';
select is((select count(*)::integer from public.entity_tags where workspace_id = '42000000-0000-4000-8000-000000000001'), 1, 'tag associations can target a CRM record in the same workspace');
select throws_ok(
  $$insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id) values ('42000000-0000-4000-8000-000000000001', (select id from public.tags where workspace_id = '42000000-0000-4000-8000-000000000001' limit 1), 'company', '43000000-0000-4000-8000-000000000003')$$,
  '23503', 'Tagged entity must exist in the tag workspace', 'tag associations cannot target another workspace record'
);
select throws_ok(
  $$insert into public.contacts (workspace_id, company_id, first_name, last_name, owner_id, created_by) values ('42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000003', 'Foreign', 'Company', '41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'admin still cannot associate a record across workspaces'
);
select throws_ok(
  $$insert into public.deals (workspace_id, pipeline_id, stage_id, title, created_by) values ('42000000-0000-4000-8000-000000000001', (select id from public.pipelines where workspace_id = '42000000-0000-4000-8000-000000000001' and is_default), (select id from public.pipeline_stages where workspace_id = '42000000-0000-4000-8000-000000000002' and name = 'Discovery'), 'Cross pipeline stage', '41000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'deal stages must belong to the deal workspace and pipeline'
);

select * from finish();
rollback;
