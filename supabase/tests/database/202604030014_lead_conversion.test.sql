begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'convert-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'convert-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('e1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'convert-viewer@example.test', '', now(), '{}', '{}', now(), now());
insert into public.workspaces (id, name, slug, default_currency)
values ('e1200000-0000-4000-8000-000000000001', 'Conversion workspace', 'conversion-test', 'EUR'),
       ('e1200000-0000-4000-8000-000000000002', 'Other conversion workspace', 'other-conversion-test', 'USD');
insert into public.workspace_members (workspace_id, user_id, role)
values ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'admin'),
       ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000002', 'member'),
       ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000003', 'viewer'),
       ('e1200000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000002', 'member');
insert into public.leads (id, workspace_id, full_name, company_name, email, phone, job_title, status, owner_id, estimated_value, currency, created_by)
values
 ('e1300000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'Taylor Reed', 'Acme', 'taylor@example.test', '555-0100', 'Director', 'qualified', 'e1100000-0000-4000-8000-000000000002', 900, 'EUR', 'e1100000-0000-4000-8000-000000000002'),
 ('e1300000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000001', 'Only Contact', null, null, null, null, 'new', 'e1100000-0000-4000-8000-000000000002', 0, 'EUR', 'e1100000-0000-4000-8000-000000000002'),
 ('e1300000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000001', 'Only Deal', null, null, null, null, 'new', 'e1100000-0000-4000-8000-000000000002', 0, 'EUR', 'e1100000-0000-4000-8000-000000000002'),
 ('e1300000-0000-4000-8000-000000000004', 'e1200000-0000-4000-8000-000000000001', 'Company Only', 'Acme', null, null, null, 'new', 'e1100000-0000-4000-8000-000000000002', 0, 'EUR', 'e1100000-0000-4000-8000-000000000002'),
 ('e1300000-0000-4000-8000-000000000005', 'e1200000-0000-4000-8000-000000000001', 'Rollback Test', 'Late Failure', null, null, null, 'new', 'e1100000-0000-4000-8000-000000000002', 0, 'EUR', 'e1100000-0000-4000-8000-000000000002'),
 ('e1300000-0000-4000-8000-000000000006', 'e1200000-0000-4000-8000-000000000001', 'Not Owned', null, null, null, 'new', 'e1100000-0000-4000-8000-000000000001', 0, 'EUR', 'e1100000-0000-4000-8000-000000000001');
insert into public.activities (workspace_id, activity_type, subject, body, created_by, related_entity_type, related_entity_id)
values ('e1200000-0000-4000-8000-000000000001', 'call', 'Discovery', 'Discussed requirements', 'e1100000-0000-4000-8000-000000000002', 'lead', 'e1300000-0000-4000-8000-000000000001');
insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
values ('e1200000-0000-4000-8000-000000000001', 'Preserve this note', 'e1100000-0000-4000-8000-000000000002', 'lead', 'e1300000-0000-4000-8000-000000000001');

create function public.fail_conversion_deal_insert() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'forced late conversion failure'; end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000002', true);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000006', '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"Not","contactLastName":"Owned"}')$$,
 '42501', null, 'member cannot convert a lead assigned to another user'
);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000002', 'e1300000-0000-4000-8000-000000000002', '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"Other","contactLastName":"Workspace"}')$$,
 '42501', null, 'member cannot convert outside their active workspace'
);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002', '{"createContact":false,"createCompany":false,"createDeal":false}')$$,
 '22023', null, 'conversion requires at least one resulting entity'
);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002', '{"createContact":false,"createCompany":false,"createDeal":true,"dealTitle":"Foreign pipeline","pipelineId":"00000000-0000-4000-8000-000000000099","stageId":"00000000-0000-4000-8000-000000000098","dealValue":1}')$$,
 '23503', null, 'deal stage must be active and in a workspace pipeline'
);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002', '{"createContact":false,"createCompany":false,"createDeal":true,"dealOwnerId":"e1100000-0000-4000-8000-000000000001"}')$$,
 '42501', null, 'members may assign deals only to themselves'
);

select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000003', true);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002', '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"View","contactLastName":"Only"}')$$,
 '42501', null, 'viewer cannot invoke conversion'
);

select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000001', true);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', '{"createContact":false,"createCompany":false,"createDeal":true,"dealOwnerId":"e1100000-0000-4000-8000-000000000099"}')$$,
 '23514', null, 'deal owner must be an active workspace member'
);
select is((public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', '{"createContact":true,"createCompany":true,"createDeal":true,"contactFirstName":"Taylor","contactLastName":"Reed","companyName":"Acme New","dealTitle":"Acme Renewal","pipelineId":"' || (select id::text from public.pipelines where workspace_id='e1200000-0000-4000-8000-000000000001' and is_default) || '","stageId":"' || (select id::text from public.pipeline_stages where workspace_id='e1200000-0000-4000-8000-000000000001' and name='Discovery') || '","dealOwnerId":"e1100000-0000-4000-8000-000000000002","dealValue":900,"closeDate":"2026-12-31"}')->>'dealId' is not null, true, 'conversion creates all selected records');
select is((select status from public.leads where id='e1300000-0000-4000-8000-000000000001'), 'converted', 'original lead is retained as converted');
select is((select count(*)::integer from public.contacts c join public.leads l on l.converted_contact_id=c.id where l.id='e1300000-0000-4000-8000-000000000001' and c.workspace_id=l.workspace_id and c.company_id=l.converted_company_id), 1, 'converted contact and company IDs link within workspace');
select is((select count(*)::integer from public.deals d join public.leads l on l.converted_deal_id=d.id where l.id='e1300000-0000-4000-8000-000000000001' and d.workspace_id=l.workspace_id and d.company_id=l.converted_company_id and d.primary_contact_id=l.converted_contact_id and d.currency='EUR'), 1, 'converted deal links to the new targets and workspace currency');
select is((select count(*)::integer from public.deals d join public.leads l on l.converted_deal_id=d.id where l.id='e1300000-0000-4000-8000-000000000001' and d.owner_id='e1100000-0000-4000-8000-000000000002'), 1, 'deal is assigned to the requested active workspace member');
select is((select count(*)::integer from public.contacts c join public.leads l on l.converted_contact_id=c.id where l.id='e1300000-0000-4000-8000-000000000001' and c.owner_id='e1100000-0000-4000-8000-000000000001'), 1, 'contact ownership remains with the converting user');
select is((select count(*)::integer from public.companies c join public.leads l on l.converted_company_id=c.id where l.id='e1300000-0000-4000-8000-000000000001' and c.owner_id='e1100000-0000-4000-8000-000000000001'), 1, 'company ownership remains with the converting user');
select is((select count(*)::integer from public.activities where related_entity_type='lead' and related_entity_id='e1300000-0000-4000-8000-000000000001'), 1, 'original activity remains on the retained lead');
select is((select count(*)::integer from public.activities where workspace_id='e1200000-0000-4000-8000-000000000001' and related_entity_type in ('contact','company','deal') and activity_type='call'), 3, 'activity is copied to each created target');
select is((select count(*)::integer from public.notes where related_entity_type='lead' and related_entity_id='e1300000-0000-4000-8000-000000000001'), 1, 'original note remains on the retained lead');
select is((select count(*)::integer from public.notes where workspace_id='e1200000-0000-4000-8000-000000000001' and related_entity_type in ('contact','company','deal') and body='Preserve this note'), 3, 'note is copied to each created target');
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"Taylor","contactLastName":"Reed"}')$$,
 '23505', null, 'lead row lock and converted-state check reject duplicate conversion'
);

select is((public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002', '{"createContact":true,"createCompany":false,"createDeal":false,"contactFirstName":"Only","contactLastName":"Contact"}')->>'dealId') is null, true, 'contact-only conversion creates no deal');
select is((select status from public.leads where id='e1300000-0000-4000-8000-000000000002'), 'converted', 'contact-only conversion records completion');
select is((public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000004', '{"createContact":false,"createCompany":true,"createDeal":false,"companyName":"Company only"}')->>'companyId') is not null, true, 'company-only conversion is supported');
select is((public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000003', '{"createContact":false,"createCompany":false,"createDeal":true,"dealTitle":"Deal only","pipelineId":"' || (select id::text from public.pipelines where workspace_id='e1200000-0000-4000-8000-000000000001' and is_default) || '","stageId":"' || (select id::text from public.pipeline_stages where workspace_id='e1200000-0000-4000-8000-000000000001' and name='Discovery') || '","dealValue":0}')->>'dealId') is not null, true, 'deal-only conversion is supported');

reset role;
create trigger fail_conversion_deal_insert before insert on public.deals for each row execute function public.fail_conversion_deal_insert();
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-4000-8000-000000000002', true);
select throws_ok(
 $$select public.convert_lead('e1200000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000005', '{"createContact":true,"createCompany":true,"createDeal":true,"contactFirstName":"Rollback","contactLastName":"Test","companyName":"Must Roll Back","dealTitle":"Forced Error","pipelineId":"' || (select id::text from public.pipelines where workspace_id='e1200000-0000-4000-8000-000000000001' and is_default) || '","stageId":"' || (select id::text from public.pipeline_stages where workspace_id='e1200000-0000-4000-8000-000000000001' and name='Discovery') || '","dealValue":10}')$$,
 'P0001', 'forced late conversion failure', 'late failure aborts company and contact insertion'
);
reset role;
select is((select count(*)::integer from public.companies where name='Must Roll Back'), 0, 'rollback leaves no company behind');
select is((select count(*)::integer from public.contacts where first_name='Rollback'), 0, 'rollback leaves no contact behind');
select is((select status from public.leads where id='e1300000-0000-4000-8000-000000000005'), 'new', 'rollback retains the unconverted lead');

drop trigger fail_conversion_deal_insert on public.deals;
drop function public.fail_conversion_deal_insert();
select * from finish();
rollback;
