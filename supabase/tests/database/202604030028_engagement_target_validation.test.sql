begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'target-validation-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('f1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'target-validation-foreign@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency) values
  ('f1200000-0000-4000-8000-000000000001', 'Target Validation Workspace', 'target-validation-workspace', 'USD'),
  ('f1200000-0000-4000-8000-000000000002', 'Foreign Target Validation Workspace', 'foreign-target-validation-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('f1200000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'manager'),
  ('f1200000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000002', 'manager');

insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by) values
  ('f1300000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001', 'Local validation lead', 'USD', 'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001'),
  ('f1300000-0000-4000-8000-000000000002', 'f1200000-0000-4000-8000-000000000002', 'Foreign validation lead', 'EUR', 'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000002');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, fixture.currency, fixture.owner_id, fixture.owner_id
from (values
  ('f1400000-0000-4000-8000-000000000001'::uuid, 'f1200000-0000-4000-8000-000000000001'::uuid, 'Local validation deal', 'USD', 'f1100000-0000-4000-8000-000000000001'::uuid),
  ('f1400000-0000-4000-8000-000000000002'::uuid, 'f1200000-0000-4000-8000-000000000002'::uuid, 'Foreign validation deal', 'EUR', 'f1100000-0000-4000-8000-000000000002'::uuid)
) as fixture(id, workspace_id, title, currency, owner_id)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'call', 'Valid lead activity', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000001')$$,
  'manager can insert activity for a lead in the same workspace'
);
select lives_ok(
  $$insert into public.tasks (workspace_id, title, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Valid lead task', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000001')$$,
  'manager can insert task for a lead in the same workspace'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Valid lead note', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000001')$$,
  'manager can insert note for a lead in the same workspace'
);
select lives_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/leads/valid.pdf', 'valid.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000001')$$,
  'manager can insert attachment for a lead in the same workspace'
);
select lives_ok(
  $$insert into public.attachments (id, workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1500000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/f1400000-0000-4000-8000-000000000001/f1500000-0000-4000-8000-000000000001/valid.pdf', 'valid.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'deal', 'f1400000-0000-4000-8000-000000000001')$$,
  'manager can insert attachment for a deal in the same workspace'
);

select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'call', 'Foreign lead activity', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000002')$$,
  '23503', null, 'activity rejects a lead from another workspace'
);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'call', 'Missing lead activity', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000099')$$,
  '23503', null, 'activity rejects a missing lead'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Foreign lead task', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000002')$$,
  '23503', null, 'task rejects a lead from another workspace'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Missing lead task', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000099')$$,
  '23503', null, 'task rejects a missing lead'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Foreign lead note', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000002')$$,
  '23503', null, 'note rejects a lead from another workspace'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'Missing lead note', 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000099')$$,
  '23503', null, 'note rejects a missing lead'
);
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/leads/foreign.pdf', 'foreign.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000002')$$,
  '23503', null, 'attachment rejects a lead from another workspace'
);
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/leads/missing.pdf', 'missing.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'lead', 'f1300000-0000-4000-8000-000000000099')$$,
  '23503', null, 'attachment rejects a missing lead'
);
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/deals/foreign.pdf', 'foreign.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'deal', 'f1400000-0000-4000-8000-000000000002')$$,
  '23503', null, 'attachment rejects a deal from another workspace'
);
select throws_ok(
  $$insert into public.attachments (workspace_id, storage_path, filename, mime_type, size_bytes, uploaded_by, related_entity_type, related_entity_id)
    values ('f1200000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001/deals/missing.pdf', 'missing.pdf', 'application/pdf', 10, 'f1100000-0000-4000-8000-000000000001', 'deal', 'f1400000-0000-4000-8000-000000000099')$$,
  '23503', null, 'attachment rejects a missing deal'
);

select * from finish();
rollback;
