create policy tasks_insert_unlinked_member on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type is null
  and related_entity_id is null
  and assigned_to is not distinct from (select auth.uid())
);
