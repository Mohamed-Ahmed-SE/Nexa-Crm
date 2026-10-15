create policy attachments_insert_owned_deal on public.attachments for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal'
  and storage_path = workspace_id::text || '/' || related_entity_id::text || '/' || id::text || '/' || filename
  and position('/' in filename) = 0 and position(chr(92) in filename) = 0
  and exists (
    select 1 from public.deals d where d.workspace_id = attachments.workspace_id
      and d.id = attachments.related_entity_id and d.owner_id = (select auth.uid())
  )
);

create policy attachments_deal_path_insert on public.attachments as restrictive for insert to authenticated with check (
  related_entity_type <> 'deal' or (
    uploaded_by = (select auth.uid())
    and storage_path = workspace_id::text || '/' || related_entity_id::text || '/' || id::text || '/' || filename
    and position('/' in filename) = 0 and position(chr(92) in filename) = 0
    and exists (
      select 1 from public.deals d where d.workspace_id = attachments.workspace_id and d.id = attachments.related_entity_id
    )
    and (
      public.has_workspace_role(workspace_id, array['admin', 'manager'])
      or (public.has_workspace_role(workspace_id, array['member']) and exists (
        select 1 from public.deals d where d.workspace_id = attachments.workspace_id
          and d.id = attachments.related_entity_id and d.owner_id = (select auth.uid())
      ))
    )
  )
);

create policy attachments_delete_owned_deal on public.attachments for delete to authenticated using (
  uploaded_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member'])
  and related_entity_type = 'deal' and exists (
    select 1 from public.deals d where d.workspace_id = attachments.workspace_id
      and d.id = attachments.related_entity_id and d.owner_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('deal-attachments', 'deal-attachments', false)
on conflict (id) do update set public = false;

create policy deal_attachments_read_member on storage.objects for select to authenticated using (
  bucket_id = 'deal-attachments' and exists (
    select 1 from public.attachments a
    join public.deals d on d.workspace_id = a.workspace_id and d.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and (storage.foldername(name))[2] = a.related_entity_id::text
      and (storage.foldername(name))[3] = a.id::text
      and array_length(storage.foldername(name), 1) = 3
      and split_part(name, '/', 4) = a.filename
      and a.related_entity_type = 'deal' and public.is_workspace_member(a.workspace_id)
  )
);

create policy deal_attachments_insert_uploader on storage.objects for insert to authenticated with check (
  bucket_id = 'deal-attachments' and exists (
    select 1 from public.attachments a
    join public.deals d on d.workspace_id = a.workspace_id and d.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and (storage.foldername(name))[2] = a.related_entity_id::text
      and (storage.foldername(name))[3] = a.id::text
      and array_length(storage.foldername(name), 1) = 3
      and split_part(name, '/', 4) = a.filename
      and a.related_entity_type = 'deal' and a.uploaded_by = (select auth.uid())
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (public.has_workspace_role(a.workspace_id, array['member']) and d.owner_id = (select auth.uid()))
      )
  )
);

create policy deal_attachments_delete_uploader on storage.objects for delete to authenticated using (
  bucket_id = 'deal-attachments' and exists (
    select 1 from public.attachments a
    join public.deals d on d.workspace_id = a.workspace_id and d.id = a.related_entity_id
    where a.storage_path = name and a.workspace_id::text = (storage.foldername(name))[1]
      and (storage.foldername(name))[2] = a.related_entity_id::text
      and (storage.foldername(name))[3] = a.id::text
      and array_length(storage.foldername(name), 1) = 3
      and split_part(name, '/', 4) = a.filename
      and a.related_entity_type = 'deal'
      and (
        public.has_workspace_role(a.workspace_id, array['admin', 'manager'])
        or (a.uploaded_by = (select auth.uid()) and public.has_workspace_role(a.workspace_id, array['member']) and d.owner_id = (select auth.uid()))
      )
  )
);
