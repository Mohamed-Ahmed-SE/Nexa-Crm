create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  website text,
  industry text,
  employee_size integer check (employee_size is null or employee_size >= 0),
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  description text,
  owner_id uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  email text,
  phone text,
  job_title text,
  linkedin_url text,
  owner_id uuid,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'inactive', 'customer', 'former_customer')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete set null (company_id)
);

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 200),
  company_name text,
  email text,
  phone text,
  job_title text,
  source_id uuid,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  owner_id uuid,
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes_summary text,
  converted_contact_id uuid,
  converted_company_id uuid,
  converted_deal_id uuid,
  converted_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id),
  foreign key (workspace_id, source_id) references public.lead_sources (workspace_id, id) on delete set null (source_id),
  foreign key (workspace_id, converted_contact_id) references public.contacts (workspace_id, id) on delete set null (converted_contact_id),
  foreign key (workspace_id, converted_company_id) references public.companies (workspace_id, id) on delete set null (converted_company_id),
  check ((status = 'converted') = (converted_at is not null))
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);
create unique index pipelines_one_default_per_workspace_idx on public.pipelines (workspace_id) where is_default;

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pipeline_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 100),
  position integer not null check (position > 0),
  probability integer not null check (probability between 0 and 100),
  stage_type text not null default 'open' check (stage_type in ('open', 'won', 'lost')),
  color_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, pipeline_id, id),
  unique (workspace_id, pipeline_id, position),
  unique (workspace_id, pipeline_id, name),
  foreign key (workspace_id, pipeline_id) references public.pipelines (workspace_id, id) on delete cascade
);
create unique index pipeline_stages_one_won_per_pipeline_idx on public.pipeline_stages (workspace_id, pipeline_id) where stage_type = 'won';
create unique index pipeline_stages_one_lost_per_pipeline_idx on public.pipeline_stages (workspace_id, pipeline_id) where stage_type = 'lost';

create table public.lost_reasons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pipeline_id uuid not null,
  stage_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  company_id uuid,
  primary_contact_id uuid,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  owner_id uuid,
  source_id uuid,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  description text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason_id uuid,
  lost_reason_text text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id),
  foreign key (workspace_id, pipeline_id, stage_id) references public.pipeline_stages (workspace_id, pipeline_id, id) on delete restrict,
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete set null (company_id),
  foreign key (workspace_id, primary_contact_id) references public.contacts (workspace_id, id) on delete set null (primary_contact_id),
  foreign key (workspace_id, source_id) references public.lead_sources (workspace_id, id) on delete set null (source_id),
  foreign key (workspace_id, lost_reason_id) references public.lost_reasons (workspace_id, id) on delete set null (lost_reason_id),
  check ((status = 'won') = (won_at is not null)),
  check ((status = 'lost') = (lost_at is not null)),
  check (status = 'lost' or (lost_reason_id is null and lost_reason_text is null))
);

alter table public.leads
  add constraint leads_converted_deal_workspace_fkey
  foreign key (workspace_id, converted_deal_id) references public.deals (workspace_id, id) on delete set null (converted_deal_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color_token text,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index tags_workspace_lower_name_idx on public.tags (workspace_id, lower(name));

create table public.entity_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  tag_id uuid not null,
  entity_type text not null check (entity_type in ('company', 'contact', 'lead', 'deal')),
  entity_id uuid not null,
  unique (workspace_id, tag_id, entity_type, entity_id),
  foreign key (workspace_id, tag_id) references public.tags (workspace_id, id) on delete cascade
);

create function public.validate_entity_tag_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (
    (new.entity_type = 'company' and exists (select 1 from public.companies e where e.workspace_id = new.workspace_id and e.id = new.entity_id))
    or (new.entity_type = 'contact' and exists (select 1 from public.contacts e where e.workspace_id = new.workspace_id and e.id = new.entity_id))
    or (new.entity_type = 'lead' and exists (select 1 from public.leads e where e.workspace_id = new.workspace_id and e.id = new.entity_id))
    or (new.entity_type = 'deal' and exists (select 1 from public.deals e where e.workspace_id = new.workspace_id and e.id = new.entity_id))
  ) then
    raise exception 'Tagged entity must exist in the tag workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger entity_tags_validate_target before insert on public.entity_tags
for each row execute function public.validate_entity_tag_target();

create index companies_workspace_created_idx on public.companies (workspace_id, created_at desc);
create index companies_workspace_owner_idx on public.companies (workspace_id, owner_id);
create index companies_workspace_name_idx on public.companies (workspace_id, lower(name));
create index contacts_workspace_created_idx on public.contacts (workspace_id, created_at desc);
create index contacts_workspace_owner_idx on public.contacts (workspace_id, owner_id);
create index contacts_workspace_company_idx on public.contacts (workspace_id, company_id);
create index contacts_workspace_email_idx on public.contacts (workspace_id, lower(email)) where email is not null;
create index leads_workspace_status_idx on public.leads (workspace_id, status);
create index leads_workspace_owner_idx on public.leads (workspace_id, owner_id);
create index leads_workspace_created_idx on public.leads (workspace_id, created_at desc);
create index leads_workspace_email_idx on public.leads (workspace_id, lower(email)) where email is not null;
create index deals_workspace_pipeline_stage_idx on public.deals (workspace_id, pipeline_id, stage_id);
create index deals_workspace_owner_idx on public.deals (workspace_id, owner_id);
create index deals_workspace_status_close_idx on public.deals (workspace_id, status, expected_close_date);
create index deals_workspace_created_idx on public.deals (workspace_id, created_at desc);
create index pipeline_stages_workspace_order_idx on public.pipeline_stages (workspace_id, pipeline_id, position);
create index entity_tags_workspace_entity_idx on public.entity_tags (workspace_id, entity_type, entity_id);

create function public.apply_workspace_default_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency is null then
    select w.default_currency into new.currency
    from public.workspaces w
    where w.id = new.workspace_id;
  end if;
  return new;
end;
$$;
create trigger leads_apply_workspace_currency before insert on public.leads
for each row execute function public.apply_workspace_default_currency();
create trigger deals_apply_workspace_currency before insert on public.deals
for each row execute function public.apply_workspace_default_currency();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger pipelines_set_updated_at before update on public.pipelines for each row execute function public.set_updated_at();
create trigger pipeline_stages_set_updated_at before update on public.pipeline_stages for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();

create function public.sync_deal_stage_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_stage public.pipeline_stages%rowtype;
begin
  select ps.* into target_stage
  from public.pipeline_stages ps
  where ps.workspace_id = new.workspace_id
    and ps.pipeline_id = new.pipeline_id
    and ps.id = new.stage_id;
  if not found then
    raise exception 'Deal stage must belong to its workspace pipeline' using errcode = '23503';
  end if;
  new.probability := target_stage.probability;
  new.status := target_stage.stage_type;
  if target_stage.stage_type = 'won' then
    new.won_at := coalesce(new.won_at, pg_catalog.now());
    new.lost_at := null;
    new.lost_reason_id := null;
    new.lost_reason_text := null;
  elsif target_stage.stage_type = 'lost' then
    new.lost_at := coalesce(new.lost_at, pg_catalog.now());
    new.won_at := null;
  else
    new.won_at := null;
    new.lost_at := null;
    new.lost_reason_id := null;
    new.lost_reason_text := null;
  end if;
  return new;
end;
$$;
create trigger deals_sync_stage_state before insert or update on public.deals
for each row execute function public.sync_deal_stage_state();

create function public.seed_workspace_crm_defaults(target_workspace_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  default_pipeline_id uuid;
  candidate_pipeline_name text;
  pipeline_name_suffix integer := 1;
  default_stage record;
  stage_position integer;
begin
  if not exists (select 1 from public.workspaces w where w.id = target_workspace_id) then
    raise exception 'Workspace must exist before CRM defaults can be seeded' using errcode = '23503';
  end if;

  insert into public.lead_sources (workspace_id, name)
  values
    (target_workspace_id, 'Website'), (target_workspace_id, 'Referral'), (target_workspace_id, 'LinkedIn'),
    (target_workspace_id, 'Outbound'), (target_workspace_id, 'Event'), (target_workspace_id, 'Partner'), (target_workspace_id, 'Other')
  on conflict (workspace_id, name) do nothing;
  insert into public.lost_reasons (workspace_id, name)
  values
    (target_workspace_id, 'Price'), (target_workspace_id, 'Timing'), (target_workspace_id, 'No response'),
    (target_workspace_id, 'Competitor'), (target_workspace_id, 'Not a fit'), (target_workspace_id, 'Budget unavailable'), (target_workspace_id, 'Other')
  on conflict (workspace_id, name) do nothing;

  select p.id into default_pipeline_id
  from public.pipelines p
  where p.workspace_id = target_workspace_id and p.is_default
  order by p.created_at, p.id
  limit 1;
  if default_pipeline_id is null then
    candidate_pipeline_name := 'Default Pipeline';
    while exists (
      select 1 from public.pipelines p
      where p.workspace_id = target_workspace_id and p.name = candidate_pipeline_name
    ) loop
      pipeline_name_suffix := pipeline_name_suffix + 1;
      candidate_pipeline_name := 'Default Pipeline (' || pipeline_name_suffix::text || ')';
    end loop;
    insert into public.pipelines (workspace_id, name, is_default)
    values (target_workspace_id, candidate_pipeline_name, true)
    returning id into default_pipeline_id;
  end if;

  for default_stage in
    select defaults.name, defaults.position, defaults.probability, defaults.stage_type
    from (values
      ('Discovery', 1, 10, 'open'), ('Qualified', 2, 30, 'open'),
      ('Proposal', 3, 60, 'open'), ('Negotiation', 4, 80, 'open'),
      ('Won', 5, 100, 'won'), ('Lost', 6, 0, 'lost')
    ) as defaults(name, position, probability, stage_type)
    order by defaults.position
  loop
    if not exists (
      select 1 from public.pipeline_stages ps
      where ps.workspace_id = target_workspace_id
        and ps.pipeline_id = default_pipeline_id
        and ps.name = default_stage.name
    ) and not (
      (default_stage.stage_type = 'won' and exists (
        select 1 from public.pipeline_stages ps
        where ps.workspace_id = target_workspace_id
          and ps.pipeline_id = default_pipeline_id
          and ps.stage_type = 'won'
      ))
      or (default_stage.stage_type = 'lost' and exists (
        select 1 from public.pipeline_stages ps
        where ps.workspace_id = target_workspace_id
          and ps.pipeline_id = default_pipeline_id
          and ps.stage_type = 'lost'
      ))
    ) then
      stage_position := default_stage.position;
      if exists (
        select 1 from public.pipeline_stages ps
        where ps.workspace_id = target_workspace_id
          and ps.pipeline_id = default_pipeline_id
          and ps.position = stage_position
      ) then
        select coalesce(max(ps.position), 0) + 1 into stage_position
        from public.pipeline_stages ps
        where ps.workspace_id = target_workspace_id and ps.pipeline_id = default_pipeline_id;
      end if;
      insert into public.pipeline_stages (workspace_id, pipeline_id, name, position, probability, stage_type)
      values (target_workspace_id, default_pipeline_id, default_stage.name, stage_position, default_stage.probability, default_stage.stage_type)
      on conflict (workspace_id, pipeline_id, name) do nothing;
    end if;
  end loop;
end;
$$;

-- create_first_workspace is SECURITY DEFINER; this trigger stays invoker-only and is not directly executable by clients.
create function public.seed_workspace_crm_defaults_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.seed_workspace_crm_defaults(new.id);
  return new;
end;
$$;
revoke all on function public.seed_workspace_crm_defaults(uuid) from public, anon, authenticated;
revoke all on function public.seed_workspace_crm_defaults_on_insert() from public, anon, authenticated;

create trigger workspaces_seed_crm_defaults after insert on public.workspaces
for each row execute function public.seed_workspace_crm_defaults_on_insert();

do $$
declare
  existing_workspace record;
begin
  for existing_workspace in select w.id from public.workspaces w order by w.id loop
    perform public.seed_workspace_crm_defaults(existing_workspace.id);
  end loop;
end;
$$;

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.lost_reasons enable row level security;
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;

create policy companies_read_member on public.companies for select to authenticated using (public.is_workspace_member(workspace_id));
create policy companies_insert_creator on public.companies for insert to authenticated with check (
  created_by = (select auth.uid()) and (
    public.has_workspace_role(workspace_id, array['admin', 'manager'])
    or (public.has_workspace_role(workspace_id, array['member']) and owner_id is not distinct from (select auth.uid()))
  )
);
create policy companies_update_manager on public.companies for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy companies_update_owned on public.companies for update to authenticated
using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']))
with check (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));
create policy companies_delete_manager on public.companies for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy companies_delete_owned on public.companies for delete to authenticated using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));

create policy contacts_read_member on public.contacts for select to authenticated using (public.is_workspace_member(workspace_id));
create policy contacts_insert_creator on public.contacts for insert to authenticated with check (
  created_by = (select auth.uid()) and (
    public.has_workspace_role(workspace_id, array['admin', 'manager'])
    or (public.has_workspace_role(workspace_id, array['member']) and owner_id is not distinct from (select auth.uid()))
  )
);
create policy contacts_update_manager on public.contacts for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy contacts_update_owned on public.contacts for update to authenticated
using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']))
with check (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));
create policy contacts_delete_manager on public.contacts for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy contacts_delete_owned on public.contacts for delete to authenticated using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));

create policy leads_read_member on public.leads for select to authenticated using (public.is_workspace_member(workspace_id));
create policy leads_insert_creator on public.leads for insert to authenticated with check (
  created_by = (select auth.uid()) and (
    public.has_workspace_role(workspace_id, array['admin', 'manager'])
    or (public.has_workspace_role(workspace_id, array['member']) and owner_id is not distinct from (select auth.uid()))
  )
);
create policy leads_update_manager on public.leads for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy leads_update_owned on public.leads for update to authenticated
using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']))
with check (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));
create policy leads_delete_manager on public.leads for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy leads_delete_owned on public.leads for delete to authenticated using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));

create policy deals_read_member on public.deals for select to authenticated using (public.is_workspace_member(workspace_id));
create policy deals_insert_creator on public.deals for insert to authenticated with check (
  created_by = (select auth.uid()) and (
    public.has_workspace_role(workspace_id, array['admin', 'manager'])
    or (public.has_workspace_role(workspace_id, array['member']) and owner_id is not distinct from (select auth.uid()))
  )
);
create policy deals_update_manager on public.deals for update to authenticated
using (public.has_workspace_role(workspace_id, array['admin', 'manager']))
with check (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy deals_update_owned on public.deals for update to authenticated
using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']))
with check (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));
create policy deals_delete_manager on public.deals for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin', 'manager']));
create policy deals_delete_owned on public.deals for delete to authenticated using (owner_id = (select auth.uid()) and public.has_workspace_role(workspace_id, array['member']));

create policy lead_sources_read_member on public.lead_sources for select to authenticated using (public.is_workspace_member(workspace_id));
create policy lead_sources_insert_admin on public.lead_sources for insert to authenticated with check (public.has_workspace_role(workspace_id, array['admin']));
create policy lead_sources_update_admin on public.lead_sources for update to authenticated using (public.has_workspace_role(workspace_id, array['admin'])) with check (public.has_workspace_role(workspace_id, array['admin']));
create policy lead_sources_delete_admin on public.lead_sources for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

create policy lost_reasons_read_member on public.lost_reasons for select to authenticated using (public.is_workspace_member(workspace_id));
create policy lost_reasons_insert_admin on public.lost_reasons for insert to authenticated with check (public.has_workspace_role(workspace_id, array['admin']));
create policy lost_reasons_update_admin on public.lost_reasons for update to authenticated using (public.has_workspace_role(workspace_id, array['admin'])) with check (public.has_workspace_role(workspace_id, array['admin']));
create policy lost_reasons_delete_admin on public.lost_reasons for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

create policy pipelines_read_member on public.pipelines for select to authenticated using (public.is_workspace_member(workspace_id));
create policy pipelines_insert_admin on public.pipelines for insert to authenticated with check (public.has_workspace_role(workspace_id, array['admin']));
create policy pipelines_update_admin on public.pipelines for update to authenticated using (public.has_workspace_role(workspace_id, array['admin'])) with check (public.has_workspace_role(workspace_id, array['admin']));
create policy pipelines_delete_admin on public.pipelines for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

create policy pipeline_stages_read_member on public.pipeline_stages for select to authenticated using (public.is_workspace_member(workspace_id));
create policy pipeline_stages_insert_admin on public.pipeline_stages for insert to authenticated with check (public.has_workspace_role(workspace_id, array['admin']));
create policy pipeline_stages_update_admin on public.pipeline_stages for update to authenticated using (public.has_workspace_role(workspace_id, array['admin'])) with check (public.has_workspace_role(workspace_id, array['admin']));
create policy pipeline_stages_delete_admin on public.pipeline_stages for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

create policy tags_read_member on public.tags for select to authenticated using (public.is_workspace_member(workspace_id));
create policy tags_insert_admin on public.tags for insert to authenticated with check (public.has_workspace_role(workspace_id, array['admin']));
create policy tags_update_admin on public.tags for update to authenticated using (public.has_workspace_role(workspace_id, array['admin'])) with check (public.has_workspace_role(workspace_id, array['admin']));
create policy tags_delete_admin on public.tags for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

create policy entity_tags_read_member on public.entity_tags for select to authenticated using (public.is_workspace_member(workspace_id));
create policy entity_tags_insert_manager on public.entity_tags for insert to authenticated with check (
  public.has_workspace_role(workspace_id, array['admin', 'manager'])
  or (public.has_workspace_role(workspace_id, array['member']) and (
    (entity_type = 'company' and exists (select 1 from public.companies e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'contact' and exists (select 1 from public.contacts e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'lead' and exists (select 1 from public.leads e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'deal' and exists (select 1 from public.deals e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
  ))
);
create policy entity_tags_delete_manager on public.entity_tags for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['admin', 'manager'])
  or (public.has_workspace_role(workspace_id, array['member']) and (
    (entity_type = 'company' and exists (select 1 from public.companies e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'contact' and exists (select 1 from public.contacts e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'lead' and exists (select 1 from public.leads e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
    or (entity_type = 'deal' and exists (select 1 from public.deals e where e.id = entity_id and e.workspace_id = entity_tags.workspace_id and e.owner_id = (select auth.uid())))
  ))
);

revoke all on table public.companies, public.contacts, public.lead_sources, public.leads, public.pipelines,
  public.pipeline_stages, public.deals, public.lost_reasons, public.tags, public.entity_tags from public, anon, authenticated;
grant select, insert, delete on public.companies, public.contacts, public.leads, public.deals to authenticated;
grant update (name, website, industry, employee_size, phone, address_line_1, address_line_2, city, state, postal_code, country, description, owner_id, archived_at) on public.companies to authenticated;
grant update (company_id, first_name, last_name, email, phone, job_title, linkedin_url, owner_id, lifecycle_status, archived_at) on public.contacts to authenticated;
grant update (full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, currency, notes_summary, converted_contact_id, converted_company_id, converted_deal_id, converted_at, archived_at) on public.leads to authenticated;
grant update (pipeline_id, stage_id, title, company_id, primary_contact_id, amount, currency, probability, expected_close_date, owner_id, source_id, priority, description, status, won_at, lost_at, lost_reason_id, lost_reason_text, archived_at) on public.deals to authenticated;
grant select, insert, delete on public.lead_sources, public.pipelines, public.pipeline_stages, public.lost_reasons, public.tags to authenticated;
grant update (name, is_active) on public.lead_sources to authenticated;
grant update (name, is_default) on public.pipelines to authenticated;
grant update (pipeline_id, name, position, probability, stage_type, color_token, is_active) on public.pipeline_stages to authenticated;
grant update (name, is_active) on public.lost_reasons to authenticated;
grant update (name, color_token) on public.tags to authenticated;
grant select, insert, delete on public.entity_tags to authenticated;

revoke all on function public.apply_workspace_default_currency() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.sync_deal_stage_state() from public, anon, authenticated;
revoke all on function public.seed_workspace_crm_defaults(uuid) from public, anon, authenticated;
revoke all on function public.seed_workspace_crm_defaults_on_insert() from public, anon, authenticated;
revoke all on function public.validate_entity_tag_target() from public, anon, authenticated;
