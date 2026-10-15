create function public.list_inactive_workspace_member_ids(target_workspace_id uuid, target_member_ids uuid[])
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership required' using errcode = '42501';
  end if;

  return query
  select wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.status = 'deactivated'
    and wm.user_id = any (coalesce(target_member_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.list_inactive_workspace_member_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.list_inactive_workspace_member_ids(uuid, uuid[]) to authenticated;
