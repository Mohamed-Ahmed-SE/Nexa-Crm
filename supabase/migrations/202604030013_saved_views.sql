create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  entity_type text not null check (entity_type in ('leads')),
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 80),
  filters jsonb not null check (pg_catalog.jsonb_typeof(filters) = 'object'),
  sort jsonb not null check (pg_catalog.jsonb_typeof(sort) = 'string'),
  visible_columns jsonb not null check (pg_catalog.jsonb_typeof(visible_columns) = 'array'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade,
  unique (workspace_id, user_id, entity_type, name)
);

create index saved_views_owner_idx on public.saved_views (workspace_id, user_id, entity_type, name);

alter table public.saved_views enable row level security;
revoke all on public.saved_views from public, anon, authenticated;
grant select, delete on public.saved_views to authenticated;
grant insert (workspace_id, user_id, entity_type, name, filters, sort, visible_columns) on public.saved_views to authenticated;
grant update (name, filters, sort, visible_columns) on public.saved_views to authenticated;

create policy saved_views_select_own on public.saved_views
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy saved_views_insert_own on public.saved_views
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy saved_views_update_own on public.saved_views
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy saved_views_delete_own on public.saved_views
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
