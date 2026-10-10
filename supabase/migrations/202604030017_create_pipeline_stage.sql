create function public.create_pipeline_stage(target_pipeline_id uuid, target_name text, target_probability integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  normalized_name text := pg_catalog.btrim(target_name);
  last_open_position integer;
begin
  select p.workspace_id into target_workspace_id
  from public.pipelines p
  where p.id = target_pipeline_id
  for update;
  if not found then
    raise exception 'Pipeline does not exist' using errcode = '22023';
  end if;
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace admin permission required' using errcode = '42501';
  end if;
  if normalized_name is null or pg_catalog.char_length(normalized_name) not between 1 and 100 then
    raise exception 'Stage name is invalid' using errcode = '22023';
  end if;
  if target_probability is null or target_probability not between 0 and 100 then
    raise exception 'Stage probability is invalid' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.max(ps.position), 0) into last_open_position
  from public.pipeline_stages ps
  where ps.workspace_id = target_workspace_id
    and ps.pipeline_id = target_pipeline_id
    and ps.stage_type = 'open';

  set constraints public.pipeline_stages_workspace_id_pipeline_id_position_key deferred;
  update public.pipeline_stages ps
  set position = ps.position + 1
  where ps.workspace_id = target_workspace_id
    and ps.pipeline_id = target_pipeline_id
    and ps.position >= last_open_position + 1;

  if exists (
    select 1 from public.pipeline_stages ps
    where ps.workspace_id = target_workspace_id
      and ps.pipeline_id = target_pipeline_id
      and ps.stage_type in ('won', 'lost')
      and ps.position < last_open_position + 1
  ) then
    with terminal_order as (
      select ps.id, last_open_position + 1 + pg_catalog.row_number() over (order by ps.position, ps.id)::integer as position
      from public.pipeline_stages ps
      where ps.workspace_id = target_workspace_id
        and ps.pipeline_id = target_pipeline_id
        and ps.stage_type in ('won', 'lost')
    )
    update public.pipeline_stages ps
    set position = terminal_order.position
    from terminal_order
    where ps.id = terminal_order.id;
  end if;

  insert into public.pipeline_stages (workspace_id, pipeline_id, name, position, probability, stage_type, is_active)
  values (target_workspace_id, target_pipeline_id, normalized_name, last_open_position + 1, target_probability, 'open', true);

  set constraints public.pipeline_stages_workspace_id_pipeline_id_position_key immediate;
end;
$$;

revoke all on function public.create_pipeline_stage(uuid, text, integer) from public, anon;
grant execute on function public.create_pipeline_stage(uuid, text, integer) to authenticated;
