create policy tasks_insert_owned_lead on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and assigned_to is not distinct from (select auth.uid())
  and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
  )
);
create policy tasks_update_owned_lead on public.tasks for update to authenticated
using (public.has_workspace_role(workspace_id, array['member']) and (
  assigned_to = (select auth.uid()) or (related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
  ))
))
with check (public.has_workspace_role(workspace_id, array['member']) and (
  assigned_to = (select auth.uid()) or (related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = tasks.workspace_id
      and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
  ))
));
create policy tasks_delete_owned_lead on public.tasks for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['member']) and (
    assigned_to = (select auth.uid()) or (related_entity_type = 'lead' and exists (
      select 1 from public.leads l where l.workspace_id = tasks.workspace_id
        and l.id = tasks.related_entity_id and l.owner_id = (select auth.uid())
    ))
  )
);

create policy notes_insert_owned_lead on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
  )
);
create policy notes_update_owned_lead on public.notes for update to authenticated
using (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
  ))
with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
  ));
create policy notes_delete_owned_lead on public.notes for delete to authenticated using (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead' and exists (
    select 1 from public.leads l where l.workspace_id = notes.workspace_id
      and l.id = notes.related_entity_id and l.owner_id = (select auth.uid())
  )
);
