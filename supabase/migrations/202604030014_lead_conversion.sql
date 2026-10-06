create or replace function public.convert_lead(target_workspace_id uuid, target_lead_id uuid, conversion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  member_role text;
  source_lead public.leads%rowtype;
  create_contact boolean;
  create_company boolean;
  create_deal boolean;
  contact_id uuid;
  company_id uuid;
  deal_id uuid;
  assigned_owner uuid;
  deal_owner_id uuid;
  deal_stage_probability integer;
  contact_first_name text;
  contact_last_name text;
  deal_close_date date;
begin
  if actor_id is null or jsonb_typeof(conversion) <> 'object' then
    raise exception 'Invalid lead conversion request' using errcode = '22023';
  end if;

  select wm.role into member_role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = actor_id and wm.status = 'active';
  if member_role is null or member_role not in ('admin', 'manager', 'member') then
    raise exception 'Lead conversion is not permitted' using errcode = '42501';
  end if;

  select l.* into source_lead
  from public.leads l
  where l.workspace_id = target_workspace_id and l.id = target_lead_id and l.archived_at is null
  for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if source_lead.status = 'converted' or source_lead.converted_at is not null
     or source_lead.converted_contact_id is not null or source_lead.converted_company_id is not null or source_lead.converted_deal_id is not null then
    raise exception 'Lead has already been converted' using errcode = '23505';
  end if;
  if member_role = 'member' and source_lead.owner_id is distinct from actor_id then
    raise exception 'Lead is not assigned to this member' using errcode = '42501';
  end if;

  if jsonb_typeof(conversion -> 'createContact') is distinct from 'boolean'
     or jsonb_typeof(conversion -> 'createCompany') is distinct from 'boolean'
     or jsonb_typeof(conversion -> 'createDeal') is distinct from 'boolean' then
    raise exception 'Choose at least one conversion record' using errcode = '22023';
  end if;
  create_contact := (conversion ->> 'createContact')::boolean;
  create_company := (conversion ->> 'createCompany')::boolean;
  create_deal := (conversion ->> 'createDeal')::boolean;
  if not (create_contact or create_company or create_deal) then
    raise exception 'Choose at least one conversion record' using errcode = '22023';
  end if;

  assigned_owner := actor_id;
  if create_deal then
    deal_owner_id := coalesce(nullif(conversion ->> 'dealOwnerId', '')::uuid, actor_id);
    if member_role = 'member' and deal_owner_id is distinct from actor_id then
      raise exception 'Members may assign deals only to themselves' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = target_workspace_id and wm.user_id = deal_owner_id and wm.status = 'active'
    ) then
      raise exception 'Deal owner must be an active member of this workspace' using errcode = '23514';
    end if;
  end if;

  if create_company and (nullif(btrim(conversion ->> 'companyName'), '') is null or char_length(btrim(conversion ->> 'companyName')) > 200) then
    raise exception 'Company name is required' using errcode = '22023';
  end if;
  if create_contact then
    contact_first_name := nullif(btrim(conversion ->> 'contactFirstName'), '');
    contact_last_name := nullif(btrim(conversion ->> 'contactLastName'), '');
    if contact_first_name is null or char_length(contact_first_name) > 100 or contact_last_name is null or char_length(contact_last_name) > 100 then
      raise exception 'Contact first and last names are required' using errcode = '22023';
    end if;
  end if;
  if create_deal then
    if nullif(btrim(conversion ->> 'dealTitle'), '') is null or char_length(btrim(conversion ->> 'dealTitle')) > 200 then
      raise exception 'Deal title is required' using errcode = '22023';
    end if;
    if nullif(conversion ->> 'pipelineId', '') is null or nullif(conversion ->> 'stageId', '') is null
       or not exists (
         select 1 from public.pipeline_stages ps
         join public.pipelines p on p.workspace_id = ps.workspace_id and p.id = ps.pipeline_id
         where ps.workspace_id = target_workspace_id
           and ps.pipeline_id = (conversion ->> 'pipelineId')::uuid
           and ps.id = (conversion ->> 'stageId')::uuid
           and ps.is_active and ps.stage_type = 'open'
       ) then
      raise exception 'Select an active open stage in this workspace pipeline' using errcode = '23503';
    end if;
    if (conversion ->> 'dealValue') is null or (conversion ->> 'dealValue')::numeric < 0 then
      raise exception 'Deal value must be non-negative' using errcode = '22023';
    end if;
    if nullif(conversion ->> 'closeDate', '') is not null then
      deal_close_date := (conversion ->> 'closeDate')::date;
    end if;
  end if;

  if create_company then
    insert into public.companies (workspace_id, name, owner_id, created_by)
    values (target_workspace_id, btrim(conversion ->> 'companyName'), assigned_owner, actor_id)
    returning id into company_id;
  end if;
  if create_contact then
    insert into public.contacts (workspace_id, company_id, first_name, last_name, email, phone, job_title, owner_id, created_by)
    values (target_workspace_id, company_id, contact_first_name, contact_last_name, source_lead.email, source_lead.phone, source_lead.job_title, assigned_owner, actor_id)
    returning id into contact_id;
  end if;
  if create_deal then
    select ps.probability into deal_stage_probability from public.pipeline_stages ps
    where ps.workspace_id = target_workspace_id and ps.pipeline_id = (conversion ->> 'pipelineId')::uuid and ps.id = (conversion ->> 'stageId')::uuid;
    insert into public.deals (workspace_id, pipeline_id, stage_id, title, company_id, primary_contact_id, amount, currency, probability, expected_close_date, owner_id, source_id, created_by)
    values (target_workspace_id, (conversion ->> 'pipelineId')::uuid, (conversion ->> 'stageId')::uuid, btrim(conversion ->> 'dealTitle'), company_id, contact_id, (conversion ->> 'dealValue')::numeric, (select w.default_currency from public.workspaces w where w.id = target_workspace_id), deal_stage_probability, deal_close_date, deal_owner_id, source_lead.source_id, actor_id)
    returning id into deal_id;
  end if;

  -- Keep the lead timeline intact and copy it to each resulting entity in this transaction.
  if contact_id is not null then
    insert into public.activities (workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event, created_at, updated_at)
    select workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, 'contact', contact_id, metadata, is_system_event, created_at, updated_at
    from public.activities where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
    insert into public.notes (workspace_id, body, is_pinned, created_by, related_entity_type, related_entity_id, created_at, updated_at)
    select workspace_id, body, is_pinned, created_by, 'contact', contact_id, created_at, updated_at
    from public.notes where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
  end if;
  if company_id is not null then
    insert into public.activities (workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event, created_at, updated_at)
    select workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, 'company', company_id, metadata, is_system_event, created_at, updated_at
    from public.activities where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
    insert into public.notes (workspace_id, body, is_pinned, created_by, related_entity_type, related_entity_id, created_at, updated_at)
    select workspace_id, body, is_pinned, created_by, 'company', company_id, created_at, updated_at
    from public.notes where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
  end if;
  if deal_id is not null then
    insert into public.activities (workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, related_entity_type, related_entity_id, metadata, is_system_event, created_at, updated_at)
    select workspace_id, activity_type, subject, body, occurred_at, created_by, owner_id, 'deal', deal_id, metadata, is_system_event, created_at, updated_at
    from public.activities where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
    insert into public.notes (workspace_id, body, is_pinned, created_by, related_entity_type, related_entity_id, created_at, updated_at)
    select workspace_id, body, is_pinned, created_by, 'deal', deal_id, created_at, updated_at
    from public.notes where workspace_id = target_workspace_id and related_entity_type = 'lead' and related_entity_id = target_lead_id;
  end if;

  update public.leads set status = 'converted', converted_contact_id = contact_id, converted_company_id = company_id,
    converted_deal_id = deal_id, converted_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where workspace_id = target_workspace_id and id = target_lead_id;

  return jsonb_build_object('contactId', contact_id, 'companyId', company_id, 'dealId', deal_id);
end;
$$;

revoke all on function public.convert_lead(uuid, uuid, jsonb) from public, anon;
grant execute on function public.convert_lead(uuid, uuid, jsonb) to authenticated;
