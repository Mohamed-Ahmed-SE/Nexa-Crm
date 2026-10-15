-- Manual activities (call/email/meeting/note) may be edited or deleted by their creator or a workspace admin.
-- System events and audit rows (record_created, owner_changed, status_changed, stage_changed, task_completed, ...)
-- stay immutable. Several audit rows are written by the app with is_system_event = false, so the manual type list
-- is enforced in addition to the flag.

create function public.can_modify_manual_activity(
  target_workspace_id uuid,
  target_created_by uuid,
  target_entity_type text,
  target_entity_id uuid,
  target_activity_type text,
  target_is_system_event boolean
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_is_system_event = false
    and target_activity_type in ('call', 'email', 'meeting', 'note')
    and (
      public.has_workspace_role(target_workspace_id, array['admin'])
      or (
        target_created_by = (select auth.uid())
        and (
          -- Mirror the insert policies: managers may write on any parent, members only on parents they own.
          public.has_workspace_role(target_workspace_id, array['manager'])
          or (
            public.has_workspace_role(target_workspace_id, array['member'])
            and (
              (target_entity_type = 'contact' and exists (
                select 1 from public.contacts c
                where c.workspace_id = target_workspace_id and c.id = target_entity_id
                  and c.owner_id = (select auth.uid())
              ))
              or (target_entity_type = 'company' and exists (
                select 1 from public.companies c
                where c.workspace_id = target_workspace_id and c.id = target_entity_id
                  and c.owner_id = (select auth.uid())
              ))
              or (target_entity_type = 'deal' and exists (
                select 1 from public.deals d
                where d.workspace_id = target_workspace_id and d.id = target_entity_id
                  and d.owner_id = (select auth.uid()) and d.archived_at is null
              ))
              or (target_entity_type = 'lead' and exists (
                select 1 from public.leads l
                where l.workspace_id = target_workspace_id and l.id = target_entity_id
                  and l.owner_id = (select auth.uid()) and l.archived_at is null
              ))
            )
          )
        )
      )
    );
$$;

create function public.guard_activity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.related_entity_type is distinct from old.related_entity_type
    or new.related_entity_id is distinct from old.related_entity_id
    or new.is_system_event is distinct from old.is_system_event then
    raise exception 'Activity identity, workspace, creator, target and system flag cannot be changed' using errcode = '42501';
  end if;
  -- owner_id is deliberately not compared: the workspace_members foreign key nulls it when a member is removed.
  if old.is_system_event and (new.activity_type, new.subject, new.body, new.occurred_at, new.metadata)
    is distinct from (old.activity_type, old.subject, old.body, old.occurred_at, old.metadata) then
    raise exception 'System events are immutable' using errcode = '42501';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger activities_guard_update before update on public.activities
for each row execute function public.guard_activity_update();

create policy activities_update_manual on public.activities for update to authenticated
using (public.can_modify_manual_activity(workspace_id, created_by, related_entity_type, related_entity_id, activity_type, is_system_event))
with check (public.can_modify_manual_activity(workspace_id, created_by, related_entity_type, related_entity_id, activity_type, is_system_event));

create policy activities_delete_manual on public.activities for delete to authenticated
using (public.can_modify_manual_activity(workspace_id, created_by, related_entity_type, related_entity_id, activity_type, is_system_event));

grant delete on public.activities to authenticated;
grant update (activity_type, subject, body, occurred_at) on public.activities to authenticated;

revoke all on function public.can_modify_manual_activity(uuid, uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.can_modify_manual_activity(uuid, uuid, text, uuid, text, boolean) to authenticated;
revoke all on function public.guard_activity_update() from public, anon, authenticated;
