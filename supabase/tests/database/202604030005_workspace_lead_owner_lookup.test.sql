begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'owner-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'owner-inactive@example.test', '', now(), '{}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'owner-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('52000000-0000-4000-8000-000000000001', 'Owner Lookup Workspace', 'owner-lookup-workspace'),
  ('52000000-0000-4000-8000-000000000002', 'Owner Lookup Foreign Workspace', 'owner-lookup-foreign');

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'member', 'active'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'member', 'deactivated'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000005', 'member', 'active');

insert into public.leads (id, workspace_id, full_name, owner_id, created_by)
values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'Inactive owner lead', '51000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', 'Active owner lead', '51000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.workspace_members where workspace_id = '52000000-0000-4000-8000-000000000001'),
  1, 'manager direct membership reads remain restricted to self'
);
select set_eq(
  $$select user_id from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', null, null)$$,
  $$values ('51000000-0000-4000-8000-000000000001'::uuid), ('51000000-0000-4000-8000-000000000002'::uuid), ('51000000-0000-4000-8000-000000000003'::uuid)$$,
  'manager owner listing returns only active members of the current workspace'
);
select is(
  (select count(*)::integer from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', null)),
  1, 'active same-workspace members may be selected for reassignment'
);
select is(
  (select count(*)::integer from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000005', null)),
  0, 'a member id from another workspace cannot be validated'
);
select is(
  (select count(*)::integer from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', '53000000-0000-4000-8000-000000000001')),
  1, 'an inactive owner may be retained only on the lead they already own'
);
select is(
  (select count(*)::integer from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', '53000000-0000-4000-8000-000000000002')),
  0, 'an inactive owner cannot be assigned to a different lead'
);
select is(
  (with changed as (
    update public.leads set owner_id = '51000000-0000-4000-8000-000000000002'
    where id = '53000000-0000-4000-8000-000000000002' returning 1
  ) select count(*)::integer from changed),
  1, 'manager can reassign a lead to an active workspace member'
);
select throws_ok(
  $$update public.leads set owner_id = '51000000-0000-4000-8000-000000000005' where id = '53000000-0000-4000-8000-000000000002'$$,
  '23503', null, 'the database rejects cross-workspace owner assignments'
);
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
select set_eq(
  $$select user_id from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', null, null)$$,
  $$values ('51000000-0000-4000-8000-000000000003'::uuid)$$,
  'a regular member sees only their own assignment identity'
);
select is(
  (select count(*)::integer from public.list_reassignable_workspace_members('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', null)),
  0, 'a regular member cannot validate another reassignment target'
);

select * from finish();
rollback;
