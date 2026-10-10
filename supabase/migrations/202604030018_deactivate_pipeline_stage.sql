create or replace function public.sync_deal_stage_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage public.pipeline_stages%rowtype;
  stage_assignment_changed boolean;
begin
  stage_assignment_changed := tg_op = 'INSERT'
    or new.workspace_id is distinct from old.workspace_id
    or new.pipeline_id is distinct from old.pipeline_id
    or new.stage_id is distinct from old.stage_id;

  perform 1
  from public.pipelines p
  where p.workspace_id = new.workspace_id
    and p.id = new.pipeline_id
  for key share;
  if not found then
    raise exception 'Deal stage must belong to its workspace pipeline' using errcode = '23503';
  end if;

  select ps.* into target_stage
  from public.pipeline_stages ps
  where ps.workspace_id = new.workspace_id
    and ps.pipeline_id = new.pipeline_id
    and ps.id = new.stage_id
  for key share;
  if not found then
    raise exception 'Deal stage must belong to its workspace pipeline' using errcode = '23503';
  end if;
  if stage_assignment_changed and target_stage.stage_type = 'open' and not target_stage.is_active then
    raise exception 'Deal stage is inactive' using errcode = 'PST02';
  end if;
  if target_stage.stage_type = 'open' and not target_stage.is_active then
    return new;
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

create function public.deactivate_pipeline_stage(target_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pipeline_id uuid;
  target_workspace_id uuid;
  target_stage_type text;
  target_is_active boolean;
  open_deal_count bigint;
begin
  select ps.pipeline_id, ps.workspace_id
  into target_pipeline_id, target_workspace_id
  from public.pipeline_stages ps
  where ps.id = target_stage_id;
  if not found then
    raise exception 'Stage does not exist' using errcode = '22023';
  end if;

  perform 1
  from public.pipelines p
  where p.id = target_pipeline_id
    and p.workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'Stage does not exist' using errcode = '22023';
  end if;
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace admin permission required' using errcode = '42501';
  end if;

  select ps.stage_type, ps.is_active
  into target_stage_type, target_is_active
  from public.pipeline_stages ps
  where ps.id = target_stage_id
    and ps.pipeline_id = target_pipeline_id
    and ps.workspace_id = target_workspace_id
  for update;
  if not found or target_stage_type <> 'open' or not target_is_active then
    raise exception 'Only active open stages can be disabled' using errcode = '22023';
  end if;

  select pg_catalog.count(*) into open_deal_count
  from public.deals d
  where d.workspace_id = target_workspace_id
    and d.pipeline_id = target_pipeline_id
    and d.stage_id = target_stage_id
    and d.status = 'open';
  if open_deal_count > 0 then
    raise exception 'Stage has open deals' using errcode = 'PST01';
  end if;

  update public.pipeline_stages ps
  set is_active = false
  where ps.id = target_stage_id
    and ps.pipeline_id = target_pipeline_id
    and ps.workspace_id = target_workspace_id
    and ps.stage_type = 'open'
    and ps.is_active;
end;
$$;

revoke update (is_active) on public.pipeline_stages from authenticated;
revoke all on function public.deactivate_pipeline_stage(uuid) from public, anon;
grant execute on function public.deactivate_pipeline_stage(uuid) to authenticated;
