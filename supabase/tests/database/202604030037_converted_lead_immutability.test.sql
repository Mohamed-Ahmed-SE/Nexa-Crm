begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e3100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'immutable-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('e3100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'immutable-member@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values ('e3200000-0000-4000-8000-000000000001', 'Lead Immutability Workspace', 'lead-immutability-test', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('e3200000-0000-4000-8000-000000000001', 'e3100000-0000-4000-8000-000000000001', 'manager'),
  ('e3200000-0000-4000-8000-000000000001', 'e3100000-0000-4000-8000-000000000002', 'member');

insert into public.leads (id, workspace_id, full_name, status, owner_id, currency, converted_at, created_by)
values
  ('e3300000-0000-4000-8000-000000000001', 'e3200000-0000-4000-8000-000000000001', 'Manager converted lead', 'converted', 'e3100000-0000-4000-8000-000000000002', 'USD', now(), 'e3100000-0000-4000-8000-000000000002'),
  ('e3300000-0000-4000-8000-000000000002', 'e3200000-0000-4000-8000-000000000001', 'Member converted lead', 'converted', 'e3100000-0000-4000-8000-000000000002', 'USD', now(), 'e3100000-0000-4000-8000-000000000002'),
  ('e3300000-0000-4000-8000-000000000003', 'e3200000-0000-4000-8000-000000000001', 'Direct conversion attempt', 'new', 'e3100000-0000-4000-8000-000000000002', 'USD', null, 'e3100000-0000-4000-8000-000000000002'),
  ('e3300000-0000-4000-8000-000000000004', 'e3200000-0000-4000-8000-000000000001', 'Supported conversion', 'new', 'e3100000-0000-4000-8000-000000000002', 'USD', null, 'e3100000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e3100000-0000-4000-8000-000000000001', true);
update public.leads set full_name = 'Manager edited converted lead'
where id = 'e3300000-0000-4000-8000-000000000001';
select is(
  (select full_name from public.leads where id = 'e3300000-0000-4000-8000-000000000001'),
  'Manager converted lead', 'manager update leaves converted lead unchanged'
);

select set_config('request.jwt.claim.sub', 'e3100000-0000-4000-8000-000000000002', true);
update public.leads set full_name = 'Member edited converted lead'
where id = 'e3300000-0000-4000-8000-000000000002';
select is(
  (select full_name from public.leads where id = 'e3300000-0000-4000-8000-000000000002'),
  'Member converted lead', 'member update leaves converted lead unchanged'
);

select throws_ok(
  $$update public.leads set status = 'converted' where id = 'e3300000-0000-4000-8000-000000000003'$$,
  '42501', null, 'active lead cannot be directly transitioned to converted'
);
select is(
  (select status from public.leads where id = 'e3300000-0000-4000-8000-000000000003'),
  'new', 'rejected direct transition leaves active lead unchanged'
);
select is(
  (public.convert_lead(
    'e3200000-0000-4000-8000-000000000001',
    'e3300000-0000-4000-8000-000000000004',
    '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"Supported","contactLastName":"Conversion"}'
  )->>'contactId') is not null,
  true, 'supported conversion function creates a contact'
);
select is(
  (select status from public.leads where id = 'e3300000-0000-4000-8000-000000000004'),
  'converted', 'supported conversion function converts an active lead'
);

select * from finish();
rollback;
