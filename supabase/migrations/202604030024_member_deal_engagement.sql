create function public.validate_deal_engagement_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.related_entity_type = 'deal' and not exists (
    select 1 from public.deals d
    where d.workspace_id = new.workspace_id and d.id = new.related_entity_id
  ) then
    raise exception 'Related deal must exist in the record workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger activities_validate_deal_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.activities
for each row execute function public.validate_deal_engagement_target();
create trigger tasks_validate_deal_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.tasks
for each row execute function public.validate_deal_engagement_target();
create trigger notes_validate_deal_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.notes
for each row execute function public.validate_deal_engagement_target();

create policy tasks_insert_owned_deal on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal' and assigned_to is not distinct from (select auth.uid())
  and exists (
    select 1 from public.deals d where d.workspace_id = tasks.workspace_id
      and d.id = tasks.related_entity_id and d.owner_id = (select auth.uid()) and d.archived_at is null
  )
);

create policy notes_insert_owned_deal on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal' and exists (
    select 1 from public.deals d where d.workspace_id = notes.workspace_id
      and d.id = notes.related_entity_id and d.owner_id = (select auth.uid()) and d.archived_at is null
  )
);

revoke all on function public.validate_deal_engagement_target() from public, anon, authenticated;
