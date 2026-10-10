begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'views-one@example.test', '', now(), '{}', '{}', now(), now()),
  ('d1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'views-two@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('d1200000-0000-4000-8000-000000000001', 'Views workspace', 'views-workspace', 'USD'),
       ('d1200000-0000-4000-8000-000000000002', 'Foreign workspace', 'foreign-views-workspace', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'member'),
       ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'viewer'),
       ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000002', 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.saved_views (workspace_id, user_id, entity_type, name, filters, sort, visible_columns)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'leads', 'Qualified', '{"status":"qualified"}', '"updated_desc"', '["name","status"]')$$,
  'a member can save their own view within their workspace'
);
select is((select count(*)::integer from public.saved_views), 1, 'owner can read their saved view');
select throws_ok(
  $$insert into public.saved_views (workspace_id, user_id, entity_type, name, filters, sort, visible_columns)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000002', 'leads', 'Forged owner', '{}', '"updated_desc"', '["name"]')$$,
  '42501', null, 'member cannot create a view for another user'
);
select throws_ok(
  $$insert into public.saved_views (workspace_id, user_id, entity_type, name, filters, sort, visible_columns)
    values ('d1200000-0000-4000-8000-000000000002', 'd1100000-0000-4000-8000-000000000001', 'leads', 'Foreign', '{}', '"updated_desc"', '["name"]')$$,
  '42501', null, 'member cannot create a view in another workspace'
);
select lives_ok(
  $$insert into public.saved_views (workspace_id, user_id, entity_type, name, filters, sort, visible_columns)
    values ('d1200000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'contacts', 'Contacts', '{}', '"updated_desc"', '["name"]')$$,
  'a member can save a contacts view'
);
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.saved_views), 0, 'another workspace member cannot read a private view');
update public.saved_views set name = 'Changed';
reset role;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.saved_views where workspace_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1100000-0000-4000-8000-000000000001' and name = 'Qualified'), 1, 'another workspace member cannot update a private view');
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000002', true);
set local role authenticated;
delete from public.saved_views;
reset role;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.saved_views where workspace_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1100000-0000-4000-8000-000000000001'), 2, 'another workspace member cannot delete a private view');
select * from finish();
rollback;
