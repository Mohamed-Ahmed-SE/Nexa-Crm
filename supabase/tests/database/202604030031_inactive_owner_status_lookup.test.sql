begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b3100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inactive-owner-reader@example.test', '', now(), '{}', '{}', now(), now()),
  ('b3100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'inactive-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('b3100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'inactive-owner-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('b3200000-0000-4000-8000-000000000001', 'Inactive Owner Workspace', 'inactive-owner-workspace'),
  ('b3200000-0000-4000-8000-000000000002', 'Inactive Owner Foreign Workspace', 'inactive-owner-foreign');

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  ('b3200000-0000-4000-8000-000000000001', 'b3100000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('b3200000-0000-4000-8000-000000000001', 'b3100000-0000-4000-8000-000000000002', 'member', 'deactivated'),
  ('b3200000-0000-4000-8000-000000000002', 'b3100000-0000-4000-8000-000000000003', 'member', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3100000-0000-4000-8000-000000000001', true);
select set_eq(
  $$select user_id from public.list_inactive_workspace_member_ids('b3200000-0000-4000-8000-000000000001', array['b3100000-0000-4000-8000-000000000002']::uuid[])$$,
  $$values ('b3100000-0000-4000-8000-000000000002'::uuid)$$,
  'authorized workspace member can identify requested inactive same-workspace owners'
);
select is(
  (select count(*)::integer from public.list_inactive_workspace_member_ids('b3200000-0000-4000-8000-000000000001', array['b3100000-0000-4000-8000-000000000001']::uuid[])),
  0, 'active members are not reported as inactive'
);
select is(
  (select count(*)::integer from public.list_inactive_workspace_member_ids('b3200000-0000-4000-8000-000000000001', array['b3100000-0000-4000-8000-000000000003']::uuid[])),
  0, 'IDs from another workspace are not disclosed as inactive'
);
select throws_ok(
  $$select * from public.list_inactive_workspace_member_ids('b3200000-0000-4000-8000-000000000002', array['b3100000-0000-4000-8000-000000000003']::uuid[])$$,
  '42501', null, 'cross-workspace lookup is denied'
);

select * from finish();
rollback;
