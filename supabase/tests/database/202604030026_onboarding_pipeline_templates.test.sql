begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2600000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'template-standard@example.test', '', now(), '{}', '{}', now(), now()),
  ('f2600000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'template-simple@example.test', '', now(), '{}', '{}', now(), now()),
  ('f2600000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'template-legacy@example.test', '', now(), '{}', '{}', now(), now()),
  ('f2600000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'template-invalid@example.test', '', now(), '{}', '{}', now(), now());

select ok(
  has_function_privilege('authenticated', 'public.create_first_workspace(text,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_first_workspace(text,text,text)', 'EXECUTE'),
  'the template RPC is executable only by authenticated callers'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2600000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_first_workspace('Standard template workspace', null, 'standard_sales')$$,
  'authenticated user can create a workspace with the Standard Sales template'
);
select is(
  (select p.name from public.pipelines p join public.workspaces w on w.id = p.workspace_id where w.name = 'Standard template workspace' and p.is_default),
  'Standard Sales', 'Standard Sales is named as the default pipeline'
);
select is(
  (select string_agg(ps.name, ',' order by ps.position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id join public.workspaces w on w.id = p.workspace_id where w.name = 'Standard template workspace' and p.is_default),
  'Discovery,Qualified,Proposal,Negotiation,Won,Lost', 'Standard Sales stages retain their documented order'
);
select is(
  (select string_agg(ps.name || ':' || ps.probability::text || ':' || ps.stage_type, ',' order by ps.position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id join public.workspaces w on w.id = p.workspace_id where w.name = 'Standard template workspace' and p.is_default),
  'Discovery:10:open,Qualified:30:open,Proposal:60:open,Negotiation:80:open,Won:100:won,Lost:0:lost', 'Standard Sales stage probabilities and terminal types match defaults'
);

select set_config('request.jwt.claim.sub', 'f2600000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.create_first_workspace('Simple template workspace', null, 'simple_sales')$$,
  'authenticated user can create a workspace with the Simple Sales template'
);
select is(
  (select p.name from public.pipelines p join public.workspaces w on w.id = p.workspace_id where w.name = 'Simple template workspace' and p.is_default),
  'Simple Sales', 'Simple Sales is named as the default pipeline'
);
select is(
  (select string_agg(ps.name, ',' order by ps.position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id join public.workspaces w on w.id = p.workspace_id where w.name = 'Simple template workspace' and p.is_default),
  'Qualified,Proposal,Won,Lost', 'Simple Sales stages are ordered without unused stages'
);
select is(
  (select string_agg(ps.name || ':' || ps.probability::text || ':' || ps.stage_type, ',' order by ps.position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id join public.workspaces w on w.id = p.workspace_id where w.name = 'Simple template workspace' and p.is_default),
  'Qualified:30:open,Proposal:70:open,Won:100:won,Lost:0:lost', 'Simple Sales probabilities and terminal types are configured'
);

select set_config('request.jwt.claim.sub', 'f2600000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$select public.create_first_workspace('Legacy template workspace', null)$$,
  'the existing two-argument workspace RPC remains callable'
);
select is(
  (select string_agg(ps.name, ',' order by ps.position) from public.pipeline_stages ps join public.pipelines p on p.id = ps.pipeline_id and p.workspace_id = ps.workspace_id join public.workspaces w on w.id = p.workspace_id where w.name = 'Legacy template workspace' and p.is_default),
  'Discovery,Qualified,Proposal,Negotiation,Won,Lost', 'legacy workspace creation keeps the seeded Standard Sales stages'
);

select set_config('request.jwt.claim.sub', 'f2600000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.create_first_workspace('Invalid template workspace', null, 'custom_sql')$$,
  '22023', 'Unsupported pipeline template', 'unsupported pipeline template is rejected'
);
reset role;
select is(
  (select count(*)::integer from public.workspaces where name = 'Invalid template workspace'),
  0, 'invalid template rejection leaves no workspace behind'
);

select * from finish();
rollback;
