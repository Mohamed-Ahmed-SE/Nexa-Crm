create policy activities_insert_owned_deal on public.activities for insert to authenticated with check (
  is_system_event = false and created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal'
  and exists (
    select 1 from public.deals d
    where d.workspace_id = activities.workspace_id
      and d.id = activities.related_entity_id
      and d.owner_id = (select auth.uid())
      and d.archived_at is null
  )
);

create policy tasks_update_owned_deal on public.tasks for update to authenticated
using (
  public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal'
  and exists (
    select 1 from public.deals d
    where d.workspace_id = tasks.workspace_id
      and d.id = tasks.related_entity_id
      and d.owner_id = (select auth.uid())
      and d.archived_at is null
  )
)
with check (
  public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal'
  and exists (
    select 1 from public.deals d
    where d.workspace_id = tasks.workspace_id
      and d.id = tasks.related_entity_id
      and d.owner_id = (select auth.uid())
      and d.archived_at is null
  )
);
