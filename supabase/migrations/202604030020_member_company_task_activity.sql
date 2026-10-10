create policy activities_insert_assigned_company_task_completion on public.activities for insert to authenticated with check (
  is_system_event = false
  and activity_type = 'task_completed'
  and created_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company'
  and exists (
    select 1 from public.tasks t
    where t.workspace_id = activities.workspace_id
      and (activities.metadata ->> 'task_id') = t.id::text
      and t.related_entity_type = 'company'
      and t.related_entity_id = activities.related_entity_id
      and t.assigned_to = (select auth.uid())
      and t.status = 'completed'
  )
);
