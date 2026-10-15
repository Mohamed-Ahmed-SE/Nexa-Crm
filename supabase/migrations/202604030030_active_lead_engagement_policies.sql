drop policy activities_insert_owned_lead on public.activities;
create policy activities_insert_owned_lead on public.activities for insert to authenticated with check (
  is_system_event = false and created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead'
  and exists (
    select 1 from public.leads l
    where l.workspace_id = activities.workspace_id
      and l.id = activities.related_entity_id
      and l.owner_id = (select auth.uid())
      and l.archived_at is null
  )
);

drop policy tasks_insert_owned_lead on public.tasks;
create policy tasks_insert_owned_lead on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and assigned_to is not distinct from (select auth.uid())
  and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  )
);

drop policy tasks_update_owned_lead on public.tasks;
create policy tasks_update_owned_lead on public.tasks for update to authenticated
using (public.has_workspace_role(workspace_id, array['member']) and (
  (assigned_to = (select auth.uid()) and (
    related_entity_type is distinct from 'lead' or exists (
      select 1 from public.leads l where l.workspace_id = tasks.workspace_id
        and l.id = tasks.related_entity_id and l.archived_at is null
    )
  )) or (related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  ))
))
with check (public.has_workspace_role(workspace_id, array['member']) and (
  (assigned_to = (select auth.uid()) and (
    related_entity_type is distinct from 'lead' or exists (
      select 1 from public.leads l where l.workspace_id = tasks.workspace_id
        and l.id = tasks.related_entity_id and l.archived_at is null
    )
  )) or (related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  ))
));

drop policy notes_insert_owned_lead on public.notes;
create policy notes_insert_owned_lead on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  )
);

drop policy notes_update_owned_lead on public.notes;
create policy notes_update_owned_lead on public.notes for update to authenticated
using (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  ))
with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
      and l.archived_at is null
  ));
