begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a3800000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'contact-address@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('a3900000-0000-4000-8000-000000000001', 'Contact Address Workspace', 'contact-address-test', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values ('a3900000-0000-4000-8000-000000000001', 'a3800000-0000-4000-8000-000000000001', 'manager');
insert into public.contacts (id, workspace_id, first_name, last_name, created_by)
values ('a3a00000-0000-4000-8000-000000000001', 'a3900000-0000-4000-8000-000000000001', 'No', 'Address', 'a3800000-0000-4000-8000-000000000001');

select is((select address from public.contacts where id = 'a3a00000-0000-4000-8000-000000000001'), null::text, 'address is nullable for existing and new contacts');
select throws_ok(
  $$insert into public.contacts (workspace_id, first_name, last_name, address, created_by) values ('a3900000-0000-4000-8000-000000000001', 'Too', 'Long', repeat('x', 501), 'a3800000-0000-4000-8000-000000000001')$$,
  '23514', null, 'address is limited to 500 characters'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3800000-0000-4000-8000-000000000001', true);
insert into public.contacts (id, workspace_id, first_name, last_name, address, created_by)
values ('a3a00000-0000-4000-8000-000000000002', 'a3900000-0000-4000-8000-000000000001', 'With', 'Address', E'12 Market St\nSuite 4', 'a3800000-0000-4000-8000-000000000001');
select is((select address from public.contacts where id = 'a3a00000-0000-4000-8000-000000000002'), E'12 Market St\nSuite 4', 'address is stored on contact creation');
update public.contacts set address = 'Updated location' where id = 'a3a00000-0000-4000-8000-000000000002';
select is((select address from public.contacts where id = 'a3a00000-0000-4000-8000-000000000002'), 'Updated location', 'address can be updated by an authorized contact editor');

select * from finish();
rollback;
