create or replace function public.get_workspace_report(
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
    select 1 from public.get_workspace_report_member_labels(target_workspace_id) member_label
    where member_label.user_id = target_owner_id
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
    select user_id, display_name,
      count(*) over (partition by display_name) as matching_name_count,
      case when count(*) over (partition by display_name) > 1
        then display_name || ' · #' || right(user_id::text, 8)
        else display_name end as report_name
    from public.get_workspace_report_member_labels(target_workspace_id)
  ),
  filtered_deals as (
    select d.id, d.title, d.amount, d.currency, d.status, d.owner_id, d.pipeline_id,
      d.stage_id, d.source_id, d.created_at, d.won_at, d.lost_at, d.expected_close_date,
      ps.name as stage_name, co.name as company_name, ml.report_name as owner_name,
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
    select ps.id as stage_id, ps.pipeline_id, p.name as pipeline_name, ps.name, ps.position,
      count(d.id)::integer as deal_count,
      coalesce(sum(d.amount), 0)::numeric as amount
    from public.pipeline_stages ps
    join public.pipelines p on p.workspace_id = ps.workspace_id and p.id = ps.pipeline_id
    left join public.deals d on d.workspace_id = ps.workspace_id and d.pipeline_id = ps.pipeline_id
      and d.stage_id = ps.id and d.status = 'open' and d.archived_at is null and d.currency = default_currency
      and (target_owner_id is null or d.owner_id = target_owner_id)
    where ps.workspace_id = target_workspace_id and ps.is_active
      and (target_pipeline_id is null or ps.pipeline_id = target_pipeline_id)
    group by ps.id, ps.pipeline_id, p.name, ps.name, ps.position
  ),
  funnel as (
    select ps.id as stage_id, ps.pipeline_id, p.name as pipeline_name, ps.name, ps.position,
      count(distinct d.id)::integer as deal_count
    from public.pipeline_stages ps
    join public.pipelines p on p.workspace_id = ps.workspace_id and p.id = ps.pipeline_id
    left join public.activities a on a.workspace_id = ps.workspace_id
      and a.related_entity_type = 'deal' and a.occurred_at >= target_start and a.occurred_at < target_end
      and a.metadata ->> 'to_stage_id' = ps.id::text
    left join public.deals d on d.workspace_id = a.workspace_id and d.id = a.related_entity_id
      and d.pipeline_id = ps.pipeline_id and d.archived_at is null
      and (target_owner_id is null or d.owner_id = target_owner_id)
    where ps.workspace_id = target_workspace_id and ps.is_active
      and (target_pipeline_id is null or ps.pipeline_id = target_pipeline_id)
    group by ps.id, ps.pipeline_id, p.name, ps.name, ps.position
  ),
  pipeline_by_owner as (
    select d.owner_id, coalesce(ml.report_name, 'Unassigned') as owner_name,
      count(d.id)::integer as deal_count, coalesce(sum(d.amount), 0)::numeric as amount
    from public.deals d
    left join member_labels ml on ml.user_id = d.owner_id
    where d.workspace_id = target_workspace_id and d.archived_at is null
      and d.status = 'open' and d.currency = default_currency
      and (target_owner_id is null or d.owner_id = target_owner_id)
      and (target_pipeline_id is null or d.pipeline_id = target_pipeline_id)
    group by d.owner_id, ml.report_name
  ),
  lead_sources as (
    select ls.id as source_id, coalesce(ls.name, 'Unspecified') as source_name,
      count(l.id)::integer as lead_count, coalesce(sum(l.estimated_value), 0)::numeric as estimated_value
    from public.leads l
    left join public.lead_sources ls on ls.workspace_id = l.workspace_id and ls.id = l.source_id
    where l.workspace_id = target_workspace_id and l.archived_at is null
      and l.currency = default_currency and l.created_at >= target_start and l.created_at < target_end
      and (target_owner_id is null or l.owner_id = target_owner_id)
    group by ls.id, coalesce(ls.name, 'Unspecified')
  ),
  task_counts as (
    select
      count(*) filter (where t.status = 'completed' and t.completed_at >= target_start and t.completed_at < target_end)::integer as completed,
      count(*) filter (where t.status = 'open' and t.due_at < now())::integer as overdue
    from public.tasks t
    where t.workspace_id = target_workspace_id
      and (target_owner_id is null or t.assigned_to = target_owner_id)
      and (target_pipeline_id is null or (t.related_entity_type = 'deal' and exists (
        select 1 from public.deals task_deal
        where task_deal.workspace_id = target_workspace_id and task_deal.id = t.related_entity_id
          and task_deal.pipeline_id = target_pipeline_id and task_deal.archived_at is null
      )))
  ),
  revenue as (
    select date_trunc('month', won_at) as month, sum(amount)::numeric as amount, count(*)::integer as deals
    from wins group by date_trunc('month', won_at)
  ),
  sources as (
    select source_id, source_name as name, count(*)::integer as deals, sum(amount)::numeric as amount
    from created group by source_id, source_name
  ),
  activities as (
    select a.created_by as owner_id, coalesce(ml.report_name, 'Member · ' || right(a.created_by::text, 8)) as owner_name,
      count(*)::integer as activity_count
    from public.activities a
    left join member_labels ml on ml.user_id = a.created_by
    where a.workspace_id = target_workspace_id and a.occurred_at >= target_start and a.occurred_at < target_end
      and a.is_system_event IS FALSE and a.activity_type <> 'stage_changed'
      and (target_owner_id is null or a.created_by = target_owner_id)
      and (target_pipeline_id is null or (a.related_entity_type = 'deal' and exists (
        select 1 from public.deals activity_deal
        where activity_deal.workspace_id = target_workspace_id and activity_deal.id = a.related_entity_id
          and activity_deal.pipeline_id = target_pipeline_id and activity_deal.archived_at is null
      )))
    group by a.created_by, ml.report_name
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
    'pipeline_by_stage', coalesce((select jsonb_agg(jsonb_build_object('pipeline_id', pipeline_id, 'pipeline', pipeline_name, 'stage_id', stage_id, 'name', name, 'position', position, 'deals', deal_count, 'amount', amount) order by pipeline_name, position, name) from stages), '[]'::jsonb),
    'pipeline_by_owner', coalesce((select jsonb_agg(jsonb_build_object('owner_id', owner_id, 'owner', owner_name, 'deals', deal_count, 'amount', amount) order by amount desc, owner_name, owner_id) from pipeline_by_owner), '[]'::jsonb),
    'deals_by_source', coalesce((select jsonb_agg(jsonb_build_object('source_id', source_id, 'name', name, 'deals', deals, 'amount', amount) order by deals desc, name, source_id) from sources), '[]'::jsonb),
    'lead_source_performance', coalesce((select jsonb_agg(jsonb_build_object('source_id', source_id, 'name', source_name, 'leads', lead_count, 'estimated_value', estimated_value) order by lead_count desc, source_name, source_id) from lead_sources), '[]'::jsonb),
    'tasks', (select jsonb_build_object('completed', completed, 'overdue', overdue) from task_counts),
    'deal_conversion_funnel', coalesce((select jsonb_agg(jsonb_build_object('pipeline_id', pipeline_id, 'pipeline', pipeline_name, 'stage_id', stage_id, 'name', name, 'position', position, 'deals', deal_count) order by pipeline_name, position, name) from funnel), '[]'::jsonb),
    'activity_by_rep', coalesce((select jsonb_agg(jsonb_build_object('owner_id', owner_id, 'name', owner_name, 'activities', activity_count) order by activity_count desc, owner_name) from activities), '[]'::jsonb),
    'top_deals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'company', company_name, 'owner', coalesce(nullif(trim(owner_name), ''), 'Member · ' || left(coalesce(owner_id, id)::text, 8)), 'stage', stage_name, 'amount', amount, 'created_at', created_at, 'status', status) order by amount desc, created_at desc) from (select * from created order by amount desc, created_at desc limit 10) ranked), '[]'::jsonb),
    'outcomes', jsonb_build_object('won', (select count(*)::integer from wins), 'lost', (select count(*)::integer from losses), 'open', (select count(*)::integer from filtered_deals where status = 'open'))
  ) into report;
  return report;
end;
$$;

revoke all on function public.get_workspace_report(uuid, timestamptz, timestamptz, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_workspace_report(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;

DROP POLICY tasks_update_owned_lead ON public.tasks;
CREATE POLICY tasks_update_owned_lead ON public.tasks FOR UPDATE TO authenticated
USING (public.has_workspace_role(workspace_id, array['member']) AND (
  (assigned_to = (SELECT auth.uid()) AND (
    related_entity_type IS DISTINCT FROM 'lead' OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.workspace_id = tasks.workspace_id
        AND l.id = tasks.related_entity_id AND l.archived_at IS NULL
    )
  )) OR (related_entity_type = 'lead' AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.workspace_id = tasks.workspace_id
      AND l.id = tasks.related_entity_id AND l.owner_id = (SELECT auth.uid())
      AND l.archived_at IS NULL
  ))
))
WITH CHECK (public.has_workspace_role(workspace_id, array['member']) AND (
  (assigned_to = (SELECT auth.uid()) AND (
    related_entity_type IS DISTINCT FROM 'lead' OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.workspace_id = tasks.workspace_id
        AND l.id = tasks.related_entity_id AND l.archived_at IS NULL
    )
  )) OR (related_entity_type = 'lead' AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.workspace_id = tasks.workspace_id
      AND l.id = tasks.related_entity_id AND l.owner_id = (SELECT auth.uid())
      AND l.archived_at IS NULL
  ))
));

DROP POLICY notes_update_owned_lead ON public.notes;
CREATE POLICY notes_update_owned_lead ON public.notes FOR UPDATE TO authenticated
USING (created_by = (SELECT auth.uid()) AND public.has_workspace_role(workspace_id, array['member'])
  AND related_entity_type = 'lead' AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.workspace_id = notes.workspace_id
      AND l.id = notes.related_entity_id AND l.owner_id = (SELECT auth.uid())
      AND l.archived_at IS NULL
  ))
WITH CHECK (created_by = (SELECT auth.uid()) AND public.has_workspace_role(workspace_id, array['member'])
  AND related_entity_type = 'lead' AND EXISTS (
    SELECT 1 FROM public.leads l WHERE l.workspace_id = notes.workspace_id
      AND l.id = notes.related_entity_id AND l.owner_id = (SELECT auth.uid())
      AND l.archived_at IS NULL
  ));

DROP POLICY tasks_update_owned_contact ON public.tasks;
CREATE POLICY tasks_update_owned_contact ON public.tasks FOR UPDATE TO authenticated
USING (public.has_workspace_role(workspace_id, array['member'])
  AND related_entity_type IS DISTINCT FROM 'lead'
  AND (assigned_to = (SELECT auth.uid()) OR (related_entity_type = 'contact' AND EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.workspace_id = tasks.workspace_id
      AND c.id = tasks.related_entity_id AND c.owner_id = (SELECT auth.uid())
  ))))
WITH CHECK (public.has_workspace_role(workspace_id, array['member'])
  AND related_entity_type IS DISTINCT FROM 'lead'
  AND (assigned_to = (SELECT auth.uid()) OR (related_entity_type = 'contact' AND EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.workspace_id = tasks.workspace_id
      AND c.id = tasks.related_entity_id AND c.owner_id = (SELECT auth.uid())
  ))));
