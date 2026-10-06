create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  activity_type text not null check (char_length(trim(activity_type)) between 1 and 50),
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  owner_id uuid,
  related_entity_type text not null check (related_entity_type in ('company', 'contact', 'lead', 'deal')),
  related_entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  is_system_event boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  task_type text not null default 'to-do' check (char_length(trim(task_type)) between 1 and 50),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  assigned_to uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  related_entity_type text check (related_entity_type is null or related_entity_type in ('company', 'contact', 'lead', 'deal')),
  related_entity_id uuid,
  reminder_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, assigned_to) references public.workspace_members (workspace_id, user_id) on delete set null (assigned_to),
  check ((related_entity_type is null) = (related_entity_id is null)),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  is_pinned boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  related_entity_type text not null check (related_entity_type in ('company', 'contact', 'lead', 'deal')),
  related_entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  storage_path text not null unique,
  filename text not null check (char_length(trim(filename)) between 1 and 255),
  mime_type text not null check (char_length(trim(mime_type)) between 1 and 255),
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  related_entity_type text not null check (related_entity_type in ('company', 'contact', 'lead', 'deal')),
  related_entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create function public.validate_contact_engagement_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.related_entity_type = 'contact' and not exists (
    select 1 from public.contacts c
    where c.workspace_id = new.workspace_id and c.id = new.related_entity_id
  ) then
    raise exception 'Related contact must exist in the record workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger activities_validate_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.activities
for each row execute function public.validate_contact_engagement_target();
create trigger tasks_validate_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.tasks
for each row execute function public.validate_contact_engagement_target();
create trigger notes_validate_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.notes
for each row execute function public.validate_contact_engagement_target();
create trigger attachments_validate_target before insert or update of workspace_id, related_entity_type, related_entity_id on public.attachments
for each row execute function public.validate_contact_engagement_target();

create function public.set_contact_engagement_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_contact_engagement_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_contact_engagement_updated_at();

create function public.prevent_member_task_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_workspace_role(old.workspace_id, array['member'])
    and new.assigned_to is distinct from old.assigned_to then
    raise exception 'Members cannot reassign tasks' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_prevent_member_reassignment before update of assigned_to on public.tasks
for each row execute function public.prevent_member_task_reassignment();

create index activities_workspace_entity_occurred_idx on public.activities (workspace_id, related_entity_type, related_entity_id, occurred_at desc);
create index tasks_workspace_entity_due_idx on public.tasks (workspace_id, related_entity_type, related_entity_id, due_at);
create index tasks_workspace_assignee_status_idx on public.tasks (workspace_id, assigned_to, status, due_at);
create index notes_workspace_entity_created_idx on public.notes (workspace_id, related_entity_type, related_entity_id, created_at desc);
create index attachments_workspace_entity_created_idx on public.attachments (workspace_id, related_entity_type, related_entity_id, created_at desc);

alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.attachments enable row level security;

create policy activities_read_member on public.activities for select to authenticated using (public.is_workspace_member(workspace_id));
create policy activities_insert_contact_owner on public.activities for insert to authenticated with check (
  is_system_event = false and created_by = (select auth.uid()) and (
    public.has_workspace_role(workspace_id, array['admin', 'manager'])
    or (public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'contact' and exists (
      select 1 from public.contacts c where c.workspace_id = activities.workspace_id
        and c.id = activities.related_entity_id and c.owner_id = (select auth.uid())
    ))
  )
);

create policy tasks_read_member on public.tasks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy tasks_insert_manager on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['admin', 'manager'])
);
create policy tasks_insert_owned_contact on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = tasks.workspace_id
      and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
  )
  and assigned_to is not distinct from (select auth.uid())
);
create policy tasks_update_manager on public.tasks for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy tasks_update_owned_contact on public.tasks for update to authenticated
using (public.has_workspace_role(workspace_id, array['member']) and (
  assigned_to = (select auth.uid()) or (related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = tasks.workspace_id
      and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
  ))
))
with check (public.has_workspace_role(workspace_id, array['member']) and (
  assigned_to = (select auth.uid()) or (related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = tasks.workspace_id
      and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
  ))
));
create policy tasks_delete_manager on public.tasks for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy tasks_delete_owned_contact on public.tasks for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['member']) and (
    assigned_to = (select auth.uid()) or (related_entity_type = 'contact' and exists (
      select 1 from public.contacts c where c.workspace_id = tasks.workspace_id
        and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
    ))
  )
);

create policy notes_read_member on public.notes for select to authenticated using (public.is_workspace_member(workspace_id));
create policy notes_insert_manager on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['admin', 'manager'])
);
create policy notes_insert_owned_contact on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
);
create policy notes_update_manager on public.notes for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy notes_update_owned_contact on public.notes for update to authenticated
using (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'contact' and exists (
  select 1 from public.contacts c where c.workspace_id = notes.workspace_id
    and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
))
with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'contact' and exists (
  select 1 from public.contacts c where c.workspace_id = notes.workspace_id
    and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
));
create policy notes_delete_manager on public.notes for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy notes_delete_owned_contact on public.notes for delete to authenticated using (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
);

create policy attachments_read_member on public.attachments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy attachments_insert_manager on public.attachments for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['admin', 'manager'])
);
create policy attachments_insert_owned_contact on public.attachments for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = attachments.workspace_id
      and c.id = attachments.related_entity_id and c.owner_id = (select auth.uid())
  )
);
create policy attachments_delete_manager on public.attachments for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy attachments_delete_owned_contact on public.attachments for delete to authenticated using (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'contact' and exists (
    select 1 from public.contacts c where c.workspace_id = attachments.workspace_id
      and c.id = attachments.related_entity_id and c.owner_id = (select auth.uid())
  )
);

revoke all on table public.activities, public.tasks, public.notes, public.attachments from public, anon, authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert, delete on public.tasks to authenticated;
grant select, insert, delete on public.notes to authenticated;
grant select, insert, delete on public.attachments to authenticated;
grant update (title, description, task_type, status, priority, due_at, assigned_to, related_entity_type, related_entity_id, reminder_at, completed_at) on public.tasks to authenticated;
grant update (body, is_pinned, related_entity_type, related_entity_id) on public.notes to authenticated;

revoke all on function public.validate_contact_engagement_target() from public, anon, authenticated;
revoke all on function public.set_contact_engagement_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_member_task_reassignment() from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('contact-attachments', 'contact-attachments', false)
on conflict (id) do update set public = false;

create policy contact_attachments_read_member on storage.objects for select to authenticated using (
  bucket_id = 'contact-attachments' and exists (
    select 1 from public.attachments a
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'contact'
      and public.is_workspace_member(a.workspace_id)
  )
);
create policy contact_attachments_insert_uploader on storage.objects for insert to authenticated with check (
  bucket_id = 'contact-attachments' and exists (
    select 1 from public.attachments a
    join public.contacts c on c.workspace_id = a.workspace_id and c.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'contact' and a.uploaded_by = (select auth.uid())
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (public.has_workspace_role(a.workspace_id, array['member']) and c.owner_id = (select auth.uid()))
      )
  )
);
create policy contact_attachments_delete_uploader on storage.objects for delete to authenticated using (
  bucket_id = 'contact-attachments' and exists (
    select 1 from public.attachments a
    join public.contacts c on c.workspace_id = a.workspace_id and c.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'contact'
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (a.uploaded_by = (select auth.uid()) and public.has_workspace_role(a.workspace_id, array['member']) and c.owner_id = (select auth.uid()))
      )
  )
);
