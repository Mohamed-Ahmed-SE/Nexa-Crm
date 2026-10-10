alter table public.pipeline_stages
  drop constraint pipeline_stages_workspace_id_pipeline_id_position_key,
  add constraint pipeline_stages_workspace_id_pipeline_id_position_key
    unique (workspace_id, pipeline_id, position) deferrable initially immediate;

create function public.rename_pipeline_stage(target_stage_id uuid, target_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pipeline_id uuid;
  target_workspace_id uuid;
  normalized_name text := pg_catalog.btrim(target_name);
begin
  select ps.pipeline_id, ps.workspace_id
  into target_pipeline_id, target_workspace_id
  from public.pipeline_stages ps
  where ps.id = target_stage_id and ps.stage_type = 'open' and ps.is_active;
  if not found then
    raise exception 'Stage is not editable' using errcode = '22023';
  end if;

  perform 1 from public.pipelines p where p.id = target_pipeline_id for update;
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace admin permission required' using errcode = '42501';
  end if;
  if normalized_name is null or pg_catalog.char_length(normalized_name) not between 1 and 100 then
    raise exception 'Stage name is invalid' using errcode = '22023';
  end if;

  update public.pipeline_stages ps
  set name = normalized_name
  where ps.id = target_stage_id
    and ps.pipeline_id = target_pipeline_id
    and ps.workspace_id = target_workspace_id
    and ps.stage_type = 'open'
    and ps.is_active;
  if not found then
    raise exception 'Stage is not editable' using errcode = '22023';
  end if;
end;
$$;

create function public.reorder_pipeline_stages(target_pipeline_id uuid, target_stage_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  current_stage_ids uuid[];
  current_positions integer[];
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
  if target_stage_ids is null or pg_catalog.array_position(target_stage_ids, null) is not null then
    raise exception 'Stage order is invalid' using errcode = '22023';
  end if;

  perform 1
  from public.pipeline_stages ps
  where ps.workspace_id = target_workspace_id
    and ps.pipeline_id = target_pipeline_id
    and ps.stage_type = 'open'
    and ps.is_active
  for update;

  select pg_catalog.array_agg(ps.id order by ps.position, ps.id), pg_catalog.array_agg(ps.position order by ps.position, ps.id)
  into current_stage_ids, current_positions
  from public.pipeline_stages ps
  where ps.workspace_id = target_workspace_id
    and ps.pipeline_id = target_pipeline_id
    and ps.stage_type = 'open'
    and ps.is_active;

  if coalesce(pg_catalog.cardinality(target_stage_ids), 0) <> coalesce(pg_catalog.cardinality(current_stage_ids), 0)
    or pg_catalog.cardinality(target_stage_ids) <> (select pg_catalog.count(distinct stage_id) from pg_catalog.unnest(target_stage_ids) as supplied(stage_id))
    or exists (select stage_id from pg_catalog.unnest(current_stage_ids) as current(stage_id) except select stage_id from pg_catalog.unnest(target_stage_ids) as supplied(stage_id))
    or exists (select stage_id from pg_catalog.unnest(target_stage_ids) as supplied(stage_id) except select stage_id from pg_catalog.unnest(current_stage_ids) as current(stage_id)) then
    raise exception 'Stage order must contain every active open stage exactly once' using errcode = '22023';
  end if;

  set constraints public.pipeline_stages_workspace_id_pipeline_id_position_key deferred;
  with requested_order as (
    select supplied.stage_id, current_positions[supplied.ordinality::integer] as target_position
    from pg_catalog.unnest(target_stage_ids) with ordinality as supplied(stage_id, ordinality)
  )
  update public.pipeline_stages ps
  set position = requested_order.target_position
  from requested_order
  where ps.id = requested_order.stage_id
    and ps.workspace_id = target_workspace_id
    and ps.pipeline_id = target_pipeline_id;
  set constraints public.pipeline_stages_workspace_id_pipeline_id_position_key immediate;
end;
$$;

revoke all on function public.rename_pipeline_stage(uuid, text) from public, anon;
revoke all on function public.reorder_pipeline_stages(uuid, uuid[]) from public, anon;
grant execute on function public.rename_pipeline_stage(uuid, text) to authenticated;
grant execute on function public.reorder_pipeline_stages(uuid, uuid[]) to authenticated;
