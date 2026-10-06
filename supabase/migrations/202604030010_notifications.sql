create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  recipient_id uuid not null,
  notification_type text not null check (notification_type in ('lead_assigned', 'deal_assigned', 'task_due', 'task_overdue', 'invite_accepted', 'deal_won', 'deal_lost')),
  title text not null,
  message text not null,
  related_entity_type text check (related_entity_type is null or related_entity_type in ('lead', 'deal')),
  related_entity_id uuid,
  task_id uuid,
  event_key text not null,
  created_at timestamptz not null default pg_catalog.now(),
  read_at timestamptz,
  foreign key (workspace_id, recipient_id) references public.workspace_members (workspace_id, user_id) on delete cascade,
  unique (workspace_id, recipient_id, notification_type, event_key),
  check ((related_entity_type is null) = (related_entity_id is null)),
  check ((notification_type in ('task_due', 'task_overdue')) = (task_id is not null))
);

create index notifications_inbox_idx on public.notifications (workspace_id, recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (workspace_id, recipient_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (recipient_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create function public.notify_record_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_type text := tg_argv[0];
  record_name text;
  new_owner_id uuid;
begin
  if tg_op = 'INSERT' then
    new_owner_id := new.owner_id;
  elsif old.owner_id is distinct from new.owner_id then
    new_owner_id := new.owner_id;
  else
    return new;
  end if;

  if new_owner_id is null or new_owner_id = (select auth.uid()) then
    return new;
  end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = new.workspace_id and wm.user_id = new_owner_id and wm.status = 'active'
  ) then
    return new;
  end if;

  if record_type = 'lead' then
    record_name := new.full_name;
  else
    record_name := new.title;
  end if;

  insert into public.notifications (
    workspace_id, recipient_id, notification_type, title, message,
    related_entity_type, related_entity_id, event_key
  ) values (
    new.workspace_id, new_owner_id, record_type || '_assigned',
    pg_catalog.initcap(record_type) || ' assigned to you', record_name,
    record_type, new.id, 'assignment:' || new.id::text || ':' || new.updated_at::text
  ) on conflict do nothing;
  return new;
end;
$$;

create trigger leads_notify_assignment
  after insert or update of owner_id on public.leads
  for each row execute function public.notify_record_assignment('lead');
create trigger deals_notify_assignment
  after insert or update of owner_id on public.deals
  for each row execute function public.notify_record_assignment('deal');

create function public.notify_deal_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  outcome_type text;
begin
  if new.status = old.status or new.status not in ('won', 'lost') then
    return new;
  end if;
  outcome_type := 'deal_' || new.status;
  insert into public.notifications (
    workspace_id, recipient_id, notification_type, title, message,
    related_entity_type, related_entity_id, event_key
  )
  select new.workspace_id, wm.user_id, outcome_type,
    'Deal ' || new.status, new.title, 'deal', new.id,
    outcome_type || ':' || new.id::text || ':' || new.status
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id and wm.status = 'active'
    and wm.role in ('admin', 'manager') and wm.user_id is distinct from (select auth.uid())
  on conflict do nothing;
  return new;
end;
$$;

create trigger deals_notify_outcome
  after update of status, stage_id on public.deals
  for each row execute function public.notify_deal_outcome();

create function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null then
    insert into public.notifications (
      workspace_id, recipient_id, notification_type, title, message,
      event_key
    )
    select new.workspace_id, new.invited_by, 'invite_accepted', 'Invitation accepted',
      new.email, 'invite:' || new.id::text
    where exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = new.workspace_id and wm.user_id = new.invited_by and wm.status = 'active'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger workspace_invites_notify_accepted
  after update of accepted_at on public.workspace_invites
  for each row execute function public.notify_invite_accepted();

create function public.generate_task_notifications(target_workspace_id uuid, today_start timestamptz, tomorrow_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership required' using errcode = '42501';
  end if;
  if today_start is null or tomorrow_start is null
     or today_start > pg_catalog.now() or tomorrow_start <= pg_catalog.now()
     or tomorrow_start <= today_start
     or tomorrow_start - today_start not between interval '23 hours' and interval '25 hours' then
    raise exception 'Invalid local-day bounds' using errcode = '22023';
  end if;

  insert into public.notifications (
    workspace_id, recipient_id, notification_type, title, message, task_id, event_key
  )
  select t.workspace_id, current_user_id,
    case when t.due_at < today_start then 'task_overdue' else 'task_due' end,
    case when t.due_at < today_start then 'Task overdue' else 'Task due today' end,
    t.title, t.id,
    case when t.due_at < today_start then 'task_overdue:' else 'task_due:' end || t.id::text
  from public.tasks t
  where t.workspace_id = target_workspace_id and t.assigned_to = current_user_id
    and t.status = 'open' and t.due_at is not null and t.due_at < tomorrow_start
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_record_assignment() from public, anon, authenticated;
revoke all on function public.notify_deal_outcome() from public, anon, authenticated;
revoke all on function public.notify_invite_accepted() from public, anon, authenticated;
revoke all on function public.generate_task_notifications(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.generate_task_notifications(uuid, timestamptz, timestamptz) to authenticated;
