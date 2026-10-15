drop policy leads_update_manager on public.leads;
create policy leads_update_manager on public.leads for update to authenticated
using (
  public.has_workspace_role(workspace_id, array['admin', 'manager'])
  and status <> 'converted'
)
with check (
  public.has_workspace_role(workspace_id, array['admin', 'manager'])
  and status <> 'converted'
);

drop policy leads_update_owned on public.leads;
create policy leads_update_owned on public.leads for update to authenticated
using (
  owner_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and status <> 'converted'
)
with check (
  owner_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and status <> 'converted'
);
