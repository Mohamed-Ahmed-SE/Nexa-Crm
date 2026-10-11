alter table public.notifications
  drop constraint notifications_notification_type_check,
  add constraint notifications_notification_type_check
    check (notification_type in ('lead_assigned', 'deal_assigned', 'task_due', 'task_overdue', 'task_reminder', 'invite_accepted', 'deal_won', 'deal_lost'));

do $$
declare
  task_notification_constraint text;
begin
  select constraint_row.conname into task_notification_constraint
  from pg_catalog.pg_constraint constraint_row
  where constraint_row.conrelid = 'public.notifications'::regclass
    and constraint_row.contype = 'c'
    and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%task_due%task_overdue%task_id%'
  limit 1;

  if task_notification_constraint is null then
    raise exception 'Task notification constraint was not found';
  end if;

  execute pg_catalog.format('alter table public.notifications drop constraint %I', task_notification_constraint);
end;
$$;

alter table public.notifications
  add constraint notifications_task_id_type_check
    check ((notification_type in ('task_due', 'task_overdue', 'task_reminder')) = (task_id is not null));

create or replace function public.generate_task_notifications(target_workspace_id uuid, today_start timestamptz, tomorrow_start timestamptz)
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

  insert into public.notifications (
    workspace_id, recipient_id, notification_type, title, message, task_id, event_key
  )
  select t.workspace_id, t.assigned_to, 'task_reminder', 'Task reminder', t.title, t.id,
    'task_reminder:' || t.id::text || ':' || pg_catalog.to_char(t.reminder_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  from public.tasks t
  join public.workspace_members wm
    on wm.workspace_id = t.workspace_id and wm.user_id = t.assigned_to and wm.status = 'active'
  where t.workspace_id = target_workspace_id
    and t.status = 'open'
    and t.assigned_to is not null
    and t.reminder_at is not null
    and t.reminder_at <= pg_catalog.now()
  on conflict do nothing;
end;
$$;
