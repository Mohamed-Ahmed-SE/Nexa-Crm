create function public.list_reassignable_workspace_members(
  target_workspace_id uuid,
  target_user_id uuid default null,
  target_lead_id uuid default null
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Workspace membership required' using errcode = '42501';
  end if;

  if not public.has_workspace_role(target_workspace_id, array['admin', 'manager']) then
    if target_user_id is null or target_user_id = (select auth.uid()) then
      return query
      select wm.user_id
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.status = 'active';
    end if;
    return;
  end if;

  if target_user_id is null then
    return query
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.status = 'active'
    order by wm.created_at, wm.user_id;
    return;
  end if;

  return query
  select wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = target_user_id
    and (
      wm.status = 'active'
      or (
        target_lead_id is not null
        and exists (
          select 1
          from public.leads l
          where l.workspace_id = target_workspace_id
            and l.id = target_lead_id
            and l.archived_at is null
            and l.owner_id = wm.user_id
        )
      )
    );
end;
$$;

revoke all on function public.list_reassignable_workspace_members(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_reassignable_workspace_members(uuid, uuid, uuid) to authenticated;
