create function public.get_workspace_report_member_labels(target_workspace_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership required' using errcode = '42501';
  end if;

  return query
  select wm.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Member · ' || left(wm.user_id::text, 8)) as display_name
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.get_workspace_report_member_labels(uuid) from public, anon, authenticated;
grant execute on function public.get_workspace_report_member_labels(uuid) to authenticated;

create function public.get_workspace_report(
  target_workspace_id uuid,
  target_start timestamptz,
  target_end timestamptz,
  target_owner_id uuid default null,
  target_pipeline_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  report jsonb;
  default_currency text;
begin
  if (select auth.uid()) is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership required' using errcode = '42501';
  end if;
  if target_start is null or target_end is null or target_start >= target_end or target_end - target_start > interval '366 days' then
    raise exception 'Invalid report date range' using errcode = '22023';
  end if;
  if target_owner_id is not null and not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = target_owner_id
  ) then
    raise exception 'Report owner must belong to the workspace' using errcode = '22023';
  end if;
  if target_pipeline_id is not null and not exists (
    select 1 from public.pipelines p
    where p.workspace_id = target_workspace_id and p.id = target_pipeline_id
  ) then
    raise exception 'Report pipeline must belong to the workspace' using errcode = '22023';
  end if;

  select w.default_currency into default_currency
  from public.workspaces w where w.id = target_workspace_id;

  with member_labels as (
    select user_id, display_name from public.get_workspace_report_member_labels(target_workspace_id)
  ),
  filtered_deals as (
    select d.id, d.title, d.amount, d.currency, d.status, d.owner_id, d.pipeline_id,
      d.stage_id, d.source_id, d.created_at, d.won_at, d.lost_at, d.expected_close_date,
      ps.name as stage_name, co.name as company_name, ml.display_name as owner_name,
      coalesce(ls.name, 'Unspecified') as source_name
    from public.deals d
    left join public.pipeline_stages ps on ps.workspace_id = d.workspace_id and ps.id = d.stage_id
    left join public.companies co on co.workspace_id = d.workspace_id and co.id = d.company_id
    left join member_labels ml on ml.user_id = d.owner_id
    left join public.lead_sources ls on ls.workspace_id = d.workspace_id and ls.id = d.source_id
    where d.workspace_id = target_workspace_id and d.archived_at is null
      and d.currency = default_currency
      and (target_owner_id is null or d.owner_id = target_owner_id)
      and (target_pipeline_id is null or d.pipeline_id = target_pipeline_id)
  ),
  created as (
    select * from filtered_deals where created_at >= target_start and created_at < target_end
  ),
  wins as (
    select * from filtered_deals where status = 'won' and won_at >= target_start and won_at < target_end
  ),
  losses as (
    select * from filtered_deals where status = 'lost' and lost_at >= target_start and lost_at < target_end
  ),
  stages as (
    select ps.id, ps.name, ps.position,
      count(d.id)::integer as deal_count,
      coalesce(sum(d.amount), 0)::numeric as amount
    from public.pipeline_stages ps
    left join public.deals d on d.workspace_id = ps.workspace_id and d.pipeline_id = ps.pipeline_id
      and d.stage_id = ps.id and d.status = 'open' and d.archived_at is null and d.currency = default_currency
      and (target_owner_id is null or d.owner_id = target_owner_id)
    where ps.workspace_id = target_workspace_id and ps.is_active
      and (target_pipeline_id is null or ps.pipeline_id = target_pipeline_id)
    group by ps.id, ps.name, ps.position
  ),
  revenue as (
    select date_trunc('month', won_at) as month, sum(amount)::numeric as amount, count(*)::integer as deals
    from wins group by date_trunc('month', won_at)
  ),
  sources as (
    select source_name as name, count(*)::integer as deals, sum(amount)::numeric as amount
    from created group by source_name
  ),
  activities as (
    select a.created_by as owner_id, coalesce(ml.display_name, 'Member · ' || left(a.created_by::text, 8)) as owner_name,
      count(*)::integer as activity_count
    from public.activities a
    left join member_labels ml on ml.user_id = a.created_by
    where a.workspace_id = target_workspace_id and a.occurred_at >= target_start and a.occurred_at < target_end
      and not a.is_system_event and (target_owner_id is null or a.created_by = target_owner_id)
      and (target_pipeline_id is null or (a.related_entity_type = 'deal' and exists (
        select 1 from public.deals activity_deal
        where activity_deal.workspace_id = target_workspace_id and activity_deal.id = a.related_entity_id
          and activity_deal.pipeline_id = target_pipeline_id and activity_deal.archived_at is null
      )))
    group by a.created_by, ml.display_name
  ),
  summary as (
    select (select coalesce(sum(amount), 0) from wins) as won_revenue,
      (select coalesce(sum(amount), 0) from created) as total_deal_value,
      (select count(*)::integer from created) as total_deals,
      (select count(*)::integer from wins) as won_count,
      (select count(*)::integer from losses) as lost_count,
      case when (select count(*) from created) = 0 then 0
        else (select sum(amount) from created) / (select count(*) from created) end as average_deal_value
  )
  select jsonb_build_object(
    'currency', default_currency,
    'summary', (select to_jsonb(summary) from summary),
    'revenue_trend', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'amount', amount, 'deals', deals) order by month) from revenue), '[]'::jsonb),
    'pipeline_by_stage', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'position', position, 'deals', deal_count, 'amount', amount) order by position) from stages), '[]'::jsonb),
    'deals_by_source', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'deals', deals, 'amount', amount) order by deals desc, name) from sources), '[]'::jsonb),
    'activity_by_rep', coalesce((select jsonb_agg(jsonb_build_object('owner_id', owner_id, 'name', owner_name, 'activities', activity_count) order by activity_count desc, owner_name) from activities), '[]'::jsonb),
    'top_deals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'company', company_name, 'owner', coalesce(nullif(trim(owner_name), ''), 'Member · ' || left(coalesce(owner_id, id)::text, 8)), 'stage', stage_name, 'amount', amount, 'created_at', created_at, 'status', status) order by amount desc, created_at desc) from (select * from created order by amount desc, created_at desc limit 10) ranked), '[]'::jsonb),
    'outcomes', jsonb_build_object('won', (select count(*)::integer from wins), 'lost', (select count(*)::integer from losses), 'open', (select count(*)::integer from filtered_deals where status = 'open'))
  ) into report;
  return report;
end;
$$;

revoke all on function public.get_workspace_report(uuid, timestamptz, timestamptz, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_workspace_report(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
