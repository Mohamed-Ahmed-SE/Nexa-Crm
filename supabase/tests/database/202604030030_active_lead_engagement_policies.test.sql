begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a3100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'active-lead-guard-member@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency)
values ('a3200000-0000-4000-8000-000000000001', 'Active Lead Guard Workspace', 'active-lead-guard-workspace', 'USD');

insert into public.workspace_members (workspace_id, user_id, role)
values ('a3200000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'member');

insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by)
values
  ('a3300000-0000-4000-8000-000000000001', 'a3200000-0000-4000-8000-000000000001', 'Lead to archive', 'USD', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001'),
  ('a3300000-0000-4000-8000-000000000002', 'a3200000-0000-4000-8000-000000000001', 'Active lead', 'USD', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, owner_id, related_entity_type, related_entity_id, is_system_event)
    values ('a3200000-0000-4000-8000-000000000001', 'record_created', 'Active lead activity', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'lead', 'a3300000-0000-4000-8000-000000000001', false)$$,
  'member can add activity to active owned lead'
);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'Active lead task', 'follow_up', 'medium', 'lead', 'a3300000-0000-4000-8000-000000000001')$$,
  'member can add task to active owned lead'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'Active lead note', 'a3100000-0000-4000-8000-000000000001', 'lead', 'a3300000-0000-4000-8000-000000000001')$$,
  'member can add note to active owned lead'
);
select lives_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'Active lead retarget task', 'follow_up', 'medium', 'lead', 'a3300000-0000-4000-8000-000000000002')$$,
  'member can create task used to verify relation update check'
);
select lives_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'Active lead retarget note', 'a3100000-0000-4000-8000-000000000001', 'lead', 'a3300000-0000-4000-8000-000000000002')$$,
  'member can create note used to verify relation update check'
);
reset role;
update public.leads set archived_at = now() where id = 'a3300000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3100000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.activities (workspace_id, activity_type, subject, created_by, owner_id, related_entity_type, related_entity_id, is_system_event)
    values ('a3200000-0000-4000-8000-000000000001', 'record_created', 'Archived lead activity', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'lead', 'a3300000-0000-4000-8000-000000000001', false)$$,
  '42501', null, 'member cannot add activity to owned archived lead'
);
select throws_ok(
  $$insert into public.tasks (workspace_id, created_by, assigned_to, title, task_type, priority, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001', 'Archived lead task', 'follow_up', 'medium', 'lead', 'a3300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'member cannot add task to owned archived lead'
);
select throws_ok(
  $$insert into public.notes (workspace_id, body, created_by, related_entity_type, related_entity_id)
    values ('a3200000-0000-4000-8000-000000000001', 'Archived lead note', 'a3100000-0000-4000-8000-000000000001', 'lead', 'a3300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'member cannot add note to owned archived lead'
);
update public.tasks set title = 'Updated archived task' where related_entity_id = 'a3300000-0000-4000-8000-000000000001';
select is((select title from public.tasks where related_entity_id = 'a3300000-0000-4000-8000-000000000001'), 'Active lead task', 'member cannot update existing task on archived lead');
update public.notes set body = 'Updated archived note' where related_entity_id = 'a3300000-0000-4000-8000-000000000001';
select is((select body from public.notes where related_entity_id = 'a3300000-0000-4000-8000-000000000001'), 'Active lead note', 'member cannot update existing note on archived lead');
select throws_ok($$update public.tasks set related_entity_id = 'a3300000-0000-4000-8000-000000000001' where title = 'Active lead retarget task'$$, '42501', null, 'task update check rejects retargeting engagement to archived lead');
select throws_ok($$update public.notes set related_entity_id = 'a3300000-0000-4000-8000-000000000001' where body = 'Active lead retarget note'$$, '42501', null, 'note update check rejects retargeting engagement to archived lead');

select * from finish();
rollback;
