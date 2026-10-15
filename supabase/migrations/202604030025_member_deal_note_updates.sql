create policy notes_update_owned_deal on public.notes for update to authenticated
using (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal' and exists (
    select 1 from public.deals d where d.workspace_id = notes.workspace_id
      and d.id = notes.related_entity_id and d.owner_id = (select auth.uid()) and d.archived_at is null
  )
)
with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal' and exists (
    select 1 from public.deals d where d.workspace_id = notes.workspace_id
      and d.id = notes.related_entity_id and d.owner_id = (select auth.uid()) and d.archived_at is null
  )
);
