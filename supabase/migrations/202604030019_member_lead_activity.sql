create policy activities_insert_owned_lead on public.activities for insert to authenticated with check (
  is_system_event = false and created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'lead'
  and exists (
    select 1 from public.leads l
    where l.workspace_id = activities.workspace_id
      and l.id = activities.related_entity_id
      and l.owner_id = (select auth.uid())
  )
);
