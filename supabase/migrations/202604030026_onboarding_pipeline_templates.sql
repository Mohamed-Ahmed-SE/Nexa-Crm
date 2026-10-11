create function public.create_first_workspace(
  workspace_name text,
  member_job_title text,
  pipeline_template text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_workspace_id uuid;
  default_pipeline_id uuid;
begin
  if pipeline_template is null or pipeline_template not in ('standard_sales', 'simple_sales') then
    raise exception 'Unsupported pipeline template' using errcode = '22023';
  end if;

  created_workspace_id := public.create_first_workspace(workspace_name, member_job_title);

  select p.id into default_pipeline_id
  from public.pipelines p
  where p.workspace_id = created_workspace_id and p.is_default
  for update;
  if default_pipeline_id is null then
    raise exception 'Workspace default pipeline was not created' using errcode = '23503';
  end if;

  update public.pipelines
  set name = case pipeline_template
    when 'standard_sales' then 'Standard Sales'
    else 'Simple Sales'
  end
  where id = default_pipeline_id and workspace_id = created_workspace_id;

  if pipeline_template = 'simple_sales' then
    delete from public.pipeline_stages
    where workspace_id = created_workspace_id
      and pipeline_id = default_pipeline_id
      and name in ('Discovery', 'Negotiation');

    update public.pipeline_stages
    set position = position + 1000
    where workspace_id = created_workspace_id
      and pipeline_id = default_pipeline_id
      and name in ('Qualified', 'Proposal', 'Won', 'Lost');

    update public.pipeline_stages ps
    set position = stage_template.position,
        probability = stage_template.probability,
        stage_type = stage_template.stage_type
    from (values
      ('Qualified', 1, 30, 'open'),
      ('Proposal', 2, 70, 'open'),
      ('Won', 3, 100, 'won'),
      ('Lost', 4, 0, 'lost')
    ) as stage_template(name, position, probability, stage_type)
    where ps.workspace_id = created_workspace_id
      and ps.pipeline_id = default_pipeline_id
      and ps.name = stage_template.name;
  end if;

  return created_workspace_id;
end;
$$;

revoke all on function public.create_first_workspace(text, text, text) from public, anon, authenticated;
grant execute on function public.create_first_workspace(text, text, text) to authenticated;
