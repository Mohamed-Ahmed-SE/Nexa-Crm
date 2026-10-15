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
  if new.related_entity_type = 'lead' and not exists (
    select 1 from public.leads l
    where l.workspace_id = new.workspace_id and l.id = new.related_entity_id
  ) then
    if public.has_workspace_role(new.workspace_id, array['admin', 'manager']) then
      raise exception 'Related lead must exist in the record workspace' using errcode = '23503';
    end if;
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_deal_engagement_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.related_entity_type = 'deal' and not exists (
    select 1 from public.deals d
    where d.workspace_id = new.workspace_id and d.id = new.related_entity_id
  ) then
    if public.has_workspace_role(new.workspace_id, array['admin', 'manager']) then
      raise exception 'Related deal must exist in the record workspace' using errcode = '23503';
    end if;
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists attachments_validate_deal_target on public.attachments;
create trigger attachments_validate_deal_target
before insert or update of workspace_id, related_entity_type, related_entity_id on public.attachments
for each row execute function public.validate_deal_engagement_target();
