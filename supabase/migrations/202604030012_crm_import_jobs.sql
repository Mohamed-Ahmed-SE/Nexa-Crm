create table public.crm_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  entity text not null check (entity in ('leads', 'contacts', 'companies')),
  status text not null check (status in ('completed', 'completed_with_errors', 'failed')),
  total_rows integer not null check (total_rows between 0 and 10000),
  imported_rows integer not null check (imported_rows between 0 and total_rows),
  rejected_rows integer not null check (rejected_rows between 0 and total_rows),
  row_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(row_errors) = 'array'),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, created_by) references public.workspace_members (workspace_id, user_id) on delete cascade,
  check (imported_rows + rejected_rows = total_rows),
  check ((status = 'completed' and rejected_rows = 0) or (status = 'completed_with_errors' and imported_rows > 0 and rejected_rows > 0) or (status = 'failed' and imported_rows = 0 and rejected_rows > 0))
);

create index crm_import_jobs_workspace_created_idx on public.crm_import_jobs (workspace_id, created_at desc);
alter table public.crm_import_jobs enable row level security;

create policy crm_import_jobs_read_member on public.crm_import_jobs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy crm_import_jobs_create on public.crm_import_jobs
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and public.has_workspace_role(workspace_id, array['admin', 'manager'])
  );

grant select, insert on public.crm_import_jobs to authenticated;
revoke update, delete on public.crm_import_jobs from authenticated;
