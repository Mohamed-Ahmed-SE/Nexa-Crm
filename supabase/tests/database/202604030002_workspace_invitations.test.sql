begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'person@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'other@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'expired@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'used@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'accepted@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('20000000-0000-4000-8000-000000000001', 'Invitation Test Workspace', 'invite-test-workspace'),
  ('20000000-0000-4000-8000-000000000002', 'Other Test Workspace', 'other-test-workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'manager');

insert into public.workspace_invites (id, workspace_id, email, role, token_hash, invited_by, expires_at, accepted_at)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'person@example.test', 'member', repeat('1', 64), '10000000-0000-4000-8000-000000000001', now() + interval '1 day', null),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'expired@example.test', 'viewer', repeat('2', 64), '10000000-0000-4000-8000-000000000001', now() - interval '1 second', null),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'used@example.test', 'member', repeat('3', 64), '10000000-0000-4000-8000-000000000001', now() + interval '1 day', now()),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'accepted@example.test', 'viewer', repeat('4', 64), '10000000-0000-4000-8000-000000000001', now() + interval '1 day', null);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.create_workspace_invite('20000000-0000-4000-8000-000000000001', 'new@example.test', 'member', repeat('5', 64))$$,
  '42501', 'Workspace administrator access required', 'a manager cannot create workspace invitations'
);
select throws_ok(
  $$select count(*) from public.workspace_invites$$,
  '42501', 'permission denied for table workspace_invites', 'authenticated users cannot read invitation token storage directly'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select * from public.list_workspace_invites('20000000-0000-4000-8000-000000000002')$$,
  '42501', 'Workspace administrator access required', 'an admin cannot list invitations in another workspace'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.accept_workspace_invite(repeat('1', 64))$$,
  '42501', 'The signed-in email does not match this invitation', 'a signed-in account with another email cannot accept the invite'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.accept_workspace_invite(repeat('2', 64))$$,
  '22023', 'Invitation is invalid, expired, or already used', 'an expired invitation cannot be accepted'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);
select throws_ok(
  $$select public.accept_workspace_invite(repeat('3', 64))$$,
  '22023', 'Invitation is invalid, expired, or already used', 'a previously accepted invitation cannot be reused'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', true);
select is(
  public.accept_workspace_invite(repeat('4', 64))::text,
  '20000000-0000-4000-8000-000000000001',
  'a matching signed-in user can accept the pending invitation'
);
select ok(
  exists (
    select 1 from public.workspace_members
    where workspace_id = '20000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000007'
      and role = 'viewer' and status = 'active'
  ),
  'acceptance creates the invited active membership with its assigned role'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select ok(
  exists (
    select 1 from public.list_workspace_invites('20000000-0000-4000-8000-000000000001')
    where email = 'person@example.test' and accepted_at is not null and revoked_at is null
  ),
  'successful acceptance marks the invitation as consumed'
);

select ok(
  not has_table_privilege('authenticated', 'public.workspace_members', 'UPDATE'),
  'authenticated has no table-level update privilege on workspace members'
);
select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'SELECT'),
  'authenticated retains workspace member select permission'
);
select ok(
  has_column_privilege('authenticated', 'public.workspace_members', 'role', 'UPDATE'),
  'authenticated can update the member role column'
);
select ok(
  has_column_privilege('authenticated', 'public.workspace_members', 'status', 'UPDATE'),
  'authenticated can update the member status column'
);
select ok(
  not has_column_privilege('authenticated', 'public.workspace_members', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.workspace_members', 'workspace_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.workspace_members', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.workspace_members', 'joined_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.workspace_members', 'created_at', 'UPDATE'),
  'authenticated cannot update workspace member identity or timestamp columns'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$update public.workspace_members set user_id = '10000000-0000-4000-8000-000000000003' where workspace_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table workspace_members', 'an admin cannot reassign a member user id directly'
);
select throws_ok(
  $$update public.workspace_members set workspace_id = '20000000-0000-4000-8000-000000000002' where workspace_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table workspace_members', 'an admin cannot move a member to another workspace directly'
);
update public.workspace_members set role = 'viewer'
where workspace_id = '20000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002';
select is(
  (select role from public.workspace_members where user_id = '10000000-0000-4000-8000-000000000002'),
  'viewer', 'an admin can change the role using the allowed column privilege'
);
update public.workspace_members set status = 'deactivated'
where workspace_id = '20000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002';
select is(
  (select status from public.workspace_members where user_id = '10000000-0000-4000-8000-000000000002'),
  'deactivated', 'an admin can change the status using the allowed column privilege'
);

select * from finish();
rollback;
