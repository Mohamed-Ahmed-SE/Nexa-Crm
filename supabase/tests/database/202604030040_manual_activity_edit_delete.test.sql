begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(34);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e7100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'activity-edit-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'activity-edit-peer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'activity-edit-viewer@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'activity-edit-admin@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'activity-edit-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'activity-edit-foreign-member@example.test', '', now(), '{}', '{}', now(), now()),
  ('e7100000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'activity-edit-foreign-admin@example.test', '', now(), '{}', '{}', now(), now());

insert into public.workspaces (id, name, slug, default_currency) values
  ('e7200000-0000-4000-8000-000000000001', 'Activity Edit Workspace', 'activity-edit-workspace', 'USD'),
  ('e7200000-0000-4000-8000-000000000002', 'Foreign Activity Edit Workspace', 'foreign-activity-edit-workspace', 'EUR');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001', 'member'),
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000002', 'member'),
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000003', 'viewer'),
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000004', 'admin'),
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000005', 'manager'),
  ('e7200000-0000-4000-8000-000000000002', 'e7100000-0000-4000-8000-000000000006', 'member'),
  ('e7200000-0000-4000-8000-000000000002', 'e7100000-0000-4000-8000-000000000007', 'admin');

insert into public.contacts (id, workspace_id, first_name, last_name, owner_id, created_by) values
  ('e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', 'Owned', 'Contact', 'e7100000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001'),
  ('e7300000-0000-4000-8000-000000000007', 'e7200000-0000-4000-8000-000000000002', 'Foreign', 'Contact', 'e7100000-0000-4000-8000-000000000006', 'e7100000-0000-4000-8000-000000000006');
insert into public.companies (id, workspace_id, name, owner_id, created_by) values
  ('e7300000-0000-4000-8000-000000000002', 'e7200000-0000-4000-8000-000000000001', 'Owned company', 'e7100000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001');
insert into public.leads (id, workspace_id, full_name, currency, owner_id, created_by) values
  ('e7300000-0000-4000-8000-000000000005', 'e7200000-0000-4000-8000-000000000001', 'Owned lead', 'USD', 'e7100000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001');

insert into public.deals (id, workspace_id, pipeline_id, stage_id, title, amount, currency, owner_id, created_by, archived_at)
select fixture.id, fixture.workspace_id, p.id, ps.id, fixture.title, 100, 'USD', fixture.owner_id, fixture.owner_id, fixture.archived_at
from (values
  ('e7300000-0000-4000-8000-000000000003'::uuid, 'e7200000-0000-4000-8000-000000000001'::uuid, 'Owned deal', 'e7100000-0000-4000-8000-000000000001'::uuid, null::timestamptz),
  ('e7300000-0000-4000-8000-000000000004'::uuid, 'e7200000-0000-4000-8000-000000000001'::uuid, 'Archived owned deal', 'e7100000-0000-4000-8000-000000000001'::uuid, now()),
  ('e7300000-0000-4000-8000-000000000006'::uuid, 'e7200000-0000-4000-8000-000000000001'::uuid, 'Peer deal', 'e7100000-0000-4000-8000-000000000002'::uuid, null::timestamptz)
) as fixture(id, workspace_id, title, owner_id, archived_at)
join public.pipelines p on p.workspace_id = fixture.workspace_id and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = 'Discovery';

-- member = e7...01, peer = ...02, viewer = ...03, admin = ...04, manager = ...05, foreign member = ...06, foreign admin = ...07
insert into public.activities (id, workspace_id, activity_type, subject, body, created_by, related_entity_type, related_entity_id, is_system_event) values
  ('e7400000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000002', 'e7200000-0000-4000-8000-000000000001', 'email', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'company', 'e7300000-0000-4000-8000-000000000002', false),
  ('e7400000-0000-4000-8000-000000000003', 'e7200000-0000-4000-8000-000000000001', 'meeting', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'deal', 'e7300000-0000-4000-8000-000000000003', false),
  ('e7400000-0000-4000-8000-000000000004', 'e7200000-0000-4000-8000-000000000001', 'note', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'lead', 'e7300000-0000-4000-8000-000000000005', false),
  ('e7400000-0000-4000-8000-000000000005', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'deal', 'e7300000-0000-4000-8000-000000000004', false),
  ('e7400000-0000-4000-8000-000000000006', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000002', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000007', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'deal', 'e7300000-0000-4000-8000-000000000006', false),
  ('e7400000-0000-4000-8000-000000000008', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', true),
  ('e7400000-0000-4000-8000-000000000009', 'e7200000-0000-4000-8000-000000000001', 'owner_changed', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000010', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000005', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000011', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000012', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'deal', 'e7300000-0000-4000-8000-000000000006', false),
  ('e7400000-0000-4000-8000-000000000013', 'e7200000-0000-4000-8000-000000000002', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000006', 'contact', 'e7300000-0000-4000-8000-000000000007', false),
  ('e7400000-0000-4000-8000-000000000014', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000015', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false),
  ('e7400000-0000-4000-8000-000000000016', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'Original body', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', false);
insert into public.activities (id, workspace_id, activity_type, subject, created_by, related_entity_type, related_entity_id, created_at, updated_at) values
  ('e7400000-0000-4000-8000-000000000017', 'e7200000-0000-4000-8000-000000000001', 'call', 'Original', 'e7100000-0000-4000-8000-000000000001', 'contact', 'e7300000-0000-4000-8000-000000000001', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

select ok(has_column_privilege('authenticated', 'public.activities', 'subject', 'UPDATE')
  and has_column_privilege('authenticated', 'public.activities', 'activity_type', 'UPDATE')
  and has_column_privilege('authenticated', 'public.activities', 'body', 'UPDATE')
  and has_column_privilege('authenticated', 'public.activities', 'occurred_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'is_system_event', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'created_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'workspace_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'related_entity_type', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'related_entity_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.activities', 'metadata', 'UPDATE'),
  'authenticated users can update only type, subject, body and occurred_at');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000001', true);

update public.activities set activity_type = 'meeting', subject = 'Edited contact call', body = 'Edited body', occurred_at = '2026-01-02T03:04:05Z' where id = 'e7400000-0000-4000-8000-000000000001';
select ok((select subject = 'Edited contact call' and activity_type = 'meeting' and body = 'Edited body' and occurred_at = '2026-01-02T03:04:05Z'::timestamptz from public.activities where id = 'e7400000-0000-4000-8000-000000000001'), 'member can edit type, subject, body and time of their own activity on an owned contact');
update public.activities set subject = 'Edited company email' where id = 'e7400000-0000-4000-8000-000000000002';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000002'), 'Edited company email', 'member can edit their own activity on an owned company');
update public.activities set subject = 'Edited deal meeting' where id = 'e7400000-0000-4000-8000-000000000003';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000003'), 'Edited deal meeting', 'member can edit their own activity on an owned active deal');
update public.activities set subject = 'Edited lead note' where id = 'e7400000-0000-4000-8000-000000000004';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000004'), 'Edited lead note', 'member can edit their own activity on an owned active lead');

update public.activities set subject = 'Touched' where id = 'e7400000-0000-4000-8000-000000000017';
update public.activities set subject = 'Hijacked' where id = 'e7400000-0000-4000-8000-000000000005';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000005'), 'Original', 'member cannot edit an activity on an archived deal');
update public.activities set subject = 'Hijacked' where id = 'e7400000-0000-4000-8000-000000000006';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000006'), 'Original', 'member cannot edit an activity created by someone else');
update public.activities set subject = 'Hijacked' where id = 'e7400000-0000-4000-8000-000000000007';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000007'), 'Original', 'member cannot edit their activity once the parent deal is owned by someone else');
update public.activities set subject = 'Hijacked' where id = 'e7400000-0000-4000-8000-000000000008';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000008'), 'Original', 'member cannot edit a system event');
update public.activities set subject = 'Hijacked' where id = 'e7400000-0000-4000-8000-000000000009';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000009'), 'Original', 'member cannot edit an audit activity type even when it is not flagged as a system event');

select throws_ok($$update public.activities set related_entity_id = 'e7300000-0000-4000-8000-000000000002', related_entity_type = 'company' where id = 'e7400000-0000-4000-8000-000000000015'$$, '42501', 'permission denied for table activities', 'member cannot move an activity to another entity');
select throws_ok($$update public.activities set is_system_event = true where id = 'e7400000-0000-4000-8000-000000000015'$$, '42501', 'permission denied for table activities', 'member cannot flip is_system_event');
select throws_ok($$update public.activities set created_by = 'e7100000-0000-4000-8000-000000000002' where id = 'e7400000-0000-4000-8000-000000000015'$$, '42501', 'permission denied for table activities', 'member cannot change the creator');
select throws_ok($$update public.activities set activity_type = 'stage_changed' where id = 'e7400000-0000-4000-8000-000000000015'$$, '42501', 'new row violates row-level security policy for table "activities"', 'member cannot turn a manual activity into a system-generated type');

delete from public.activities where id = 'e7400000-0000-4000-8000-000000000016';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000016'), 0, 'member can delete their own manual activity');
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000006';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000006'), 1, 'member cannot delete an activity created by someone else');
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000008';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000008'), 1, 'member cannot delete a system event');
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000009';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000009'), 1, 'member cannot delete an audit activity type');

select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000003', true);
update public.activities set subject = 'Viewer edit' where id = 'e7400000-0000-4000-8000-000000000014';
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000014';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000014'), 'Original', 'viewer cannot edit or delete an activity');

select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000005', true);
update public.activities set subject = 'Manager edit' where id = 'e7400000-0000-4000-8000-000000000010';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000010'), 'Manager edit', 'manager can edit an activity they created');
update public.activities set subject = 'Manager hijack' where id = 'e7400000-0000-4000-8000-000000000011';
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000011';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000011'), 'Original', 'manager cannot edit or delete an activity created by someone else');
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000010';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000010'), 0, 'manager can delete an activity they created');

select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000004', true);
update public.activities set subject = 'Admin edit' where id = 'e7400000-0000-4000-8000-000000000011';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000011'), 'Admin edit', 'admin can edit an activity created by a member');
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000012';
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000012'), 0, 'admin can delete a member activity on a peer-owned deal');
update public.activities set subject = 'Admin hijack' where id = 'e7400000-0000-4000-8000-000000000008';
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000008';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000008'), 'Original', 'admin cannot edit or delete a system event');
update public.activities set subject = 'Admin hijack' where id = 'e7400000-0000-4000-8000-000000000009';
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000009';
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000009'), 'Original', 'admin cannot edit or delete an audit activity type');

select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000007', true);
update public.activities set subject = 'Foreign admin edit' where id = 'e7400000-0000-4000-8000-000000000001';
delete from public.activities where id = 'e7400000-0000-4000-8000-000000000015';
select set_config('request.jwt.claim.sub', 'e7100000-0000-4000-8000-000000000006', true);
update public.activities set subject = 'Foreign member edit' where id = 'e7400000-0000-4000-8000-000000000015';

reset role;
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000001'), 'Edited contact call', 'admin of another workspace cannot edit an activity in this workspace');
select is((select count(*)::integer from public.activities where id = 'e7400000-0000-4000-8000-000000000015'), 1, 'admin of another workspace cannot delete an activity in this workspace');
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000015'), 'Original', 'member of another workspace cannot edit an activity in this workspace');
select is((select subject from public.activities where id = 'e7400000-0000-4000-8000-000000000013'), 'Original', 'activities in the other workspace were not touched by this workspace’s actors');

select throws_ok($$update public.activities set is_system_event = true where id = 'e7400000-0000-4000-8000-000000000015'$$, '42501', 'Activity identity, workspace, creator, target and system flag cannot be changed', 'guard trigger blocks flipping the system flag even without RLS');
select throws_ok($$update public.activities set subject = 'Rewritten' where id = 'e7400000-0000-4000-8000-000000000008'$$, '42501', 'System events are immutable', 'guard trigger blocks content edits on system events even without RLS');
select lives_ok($$update public.activities set owner_id = null where id = 'e7400000-0000-4000-8000-000000000008'$$, 'guard trigger still allows the owner foreign key action to clear owner_id on a system event');
select ok((select updated_at > '2026-01-01T00:00:00Z'::timestamptz and created_at = '2026-01-01T00:00:00Z'::timestamptz from public.activities where id = 'e7400000-0000-4000-8000-000000000017'), 'edits refresh updated_at without touching created_at');

select * from finish();
rollback;
