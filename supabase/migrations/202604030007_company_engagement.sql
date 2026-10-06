create or replace function public.validate_contact_engagement_target()
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
  if new.related_entity_type = 'company' and not exists (
    select 1 from public.companies c
    where c.workspace_id = new.workspace_id and c.id = new.related_entity_id
  ) then
    raise exception 'Related company must exist in the record workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

create policy activities_insert_owned_company on public.activities for insert to authenticated with check (
  is_system_event = false and created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = activities.workspace_id
      and c.id = activities.related_entity_id and c.owner_id = (select auth.uid())
  )
);

create policy tasks_insert_owned_company on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = tasks.workspace_id
      and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
  ) and assigned_to is not distinct from (select auth.uid())
);
create policy tasks_update_owned_company on public.tasks for update to authenticated
using (
  public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'company' and (
    assigned_to = (select auth.uid()) or exists (
      select 1 from public.companies c where c.workspace_id = tasks.workspace_id
        and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
    )
  )
)
with check (
  public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'company' and (
    assigned_to = (select auth.uid()) or exists (
      select 1 from public.companies c where c.workspace_id = tasks.workspace_id
        and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
    )
  )
);
create policy tasks_delete_owned_company on public.tasks for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['member']) and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = tasks.workspace_id
      and c.id = tasks.related_entity_id and c.owner_id = (select auth.uid())
  )
);

create policy notes_insert_owned_company on public.notes for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
);
create policy notes_update_owned_company on public.notes for update to authenticated
using (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
);
create policy notes_delete_owned_company on public.notes for delete to authenticated using (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = notes.workspace_id
      and c.id = notes.related_entity_id and c.owner_id = (select auth.uid())
  )
);

create policy attachments_insert_owned_company on public.attachments for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = attachments.workspace_id
      and c.id = attachments.related_entity_id and c.owner_id = (select auth.uid())
  )
);
create policy attachments_delete_owned_company on public.attachments for delete to authenticated using (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'company' and exists (
    select 1 from public.companies c where c.workspace_id = attachments.workspace_id
      and c.id = attachments.related_entity_id and c.owner_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('company-attachments', 'company-attachments', false)
on conflict (id) do update set public = false;

create policy company_attachments_read_member on storage.objects for select to authenticated using (
  bucket_id = 'company-attachments' and exists (
    select 1 from public.attachments a
    join public.companies c on c.workspace_id = a.workspace_id and c.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'company' and public.is_workspace_member(a.workspace_id)
  )
);
create policy company_attachments_insert_uploader on storage.objects for insert to authenticated with check (
  bucket_id = 'company-attachments' and exists (
    select 1 from public.attachments a
    join public.companies c on c.workspace_id = a.workspace_id and c.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'company' and a.uploaded_by = (select auth.uid())
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (public.has_workspace_role(a.workspace_id, array['member']) and c.owner_id = (select auth.uid()))
      )
  )
);
create policy company_attachments_delete_uploader on storage.objects for delete to authenticated using (
  bucket_id = 'company-attachments' and exists (
    select 1 from public.attachments a
    join public.companies c on c.workspace_id = a.workspace_id and c.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and a.related_entity_type = 'company'
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (a.uploaded_by = (select auth.uid()) and public.has_workspace_role(a.workspace_id, array['member']) and c.owner_id = (select auth.uid()))
      )
  )
);
