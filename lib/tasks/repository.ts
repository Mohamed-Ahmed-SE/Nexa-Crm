import "server-only";

import { formatTaskOwners } from "@/lib/tasks/owner-labels";
import { escapeTaskSearchTerm, restrictAllTasksView, taskDateBounds, taskLocalDateBounds, taskPageSize, taskWeekBounds, type TaskSearchParams } from "@/lib/tasks/schema";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type { TaskOwner } from "@/lib/tasks/owner-labels";
export type TaskRelation = { id: string; type: "company" | "contact" | "lead" | "deal"; label: string };
export type TaskRow = {
  id: string; title: string; description: string | null; task_type: string; status: "open" | "completed" | "cancelled";
  priority: "low" | "medium" | "high"; due_at: string | null; reminder_at: string | null; assigned_to: string | null; created_by: string;
  related_entity_type: TaskRelation["type"] | null; related_entity_id: string | null; completed_at: string | null;
  relation: TaskRelation | null;
};
export type TaskOption = { id: string; type: TaskRelation["type"]; label: string };
export type TaskOverviewCounts = { dueToday: number; overdue: number; completedThisWeek: number; upcoming: number };

export async function countWorkspaceTaskOverview(supabase: Supabase, workspaceId: string, params: Pick<TaskSearchParams, "timezoneOffset" | "tomorrowTimezoneOffset" | "weekStartTimezoneOffset" | "nextWeekTimezoneOffset">, now = new Date()): Promise<TaskOverviewCounts> {
  const { start, tomorrow } = taskDateBounds(now, params.timezoneOffset, params.tomorrowTimezoneOffset);
  const { start: weekStart, end: weekEnd } = taskWeekBounds(now, params.timezoneOffset, params.weekStartTimezoneOffset, params.nextWeekTimezoneOffset);
  const scopedTasks = () => supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  const [dueToday, overdue, completedThisWeek, upcoming] = await Promise.all([
    scopedTasks().eq("status", "open").gte("due_at", start.toISOString()).lt("due_at", tomorrow.toISOString()),
    scopedTasks().eq("status", "open").lt("due_at", start.toISOString()),
    scopedTasks().eq("status", "completed").gte("completed_at", weekStart.toISOString()).lt("completed_at", weekEnd.toISOString()),
    scopedTasks().eq("status", "open").gte("due_at", tomorrow.toISOString()),
  ]);
  if (dueToday.error || overdue.error || completedThisWeek.error || upcoming.error) throw new Error("Unable to load workspace task overview.");
  return {
    dueToday: dueToday.count ?? 0,
    overdue: overdue.count ?? 0,
    completedThisWeek: completedThisWeek.count ?? 0,
    upcoming: upcoming.count ?? 0,
  };
}

export async function listWorkspaceTasks(supabase: Supabase, { workspaceId, userId, params, canReassign, now = new Date() }: {
  workspaceId: string; userId: string; params: TaskSearchParams; canReassign: boolean; now?: Date;
}) {
  const { view } = canReassign ? params : restrictAllTasksView(params);
  const { start, tomorrow } = taskDateBounds(now, params.timezoneOffset, params.tomorrowTimezoneOffset);
  let query = supabase.from("tasks").select("id,title,description,task_type,status,priority,due_at,reminder_at,assigned_to,created_by,related_entity_type,related_entity_id,completed_at", { count: "exact" })
    .eq("workspace_id", workspaceId);
  if (!canReassign) query = query.eq("assigned_to", userId);
  switch (view) {
    case "my": query = query.eq("assigned_to", userId).eq("status", "open"); break;
    case "today": query = query.eq("status", "open").gte("due_at", start.toISOString()).lt("due_at", tomorrow.toISOString()); break;
    case "upcoming": query = query.eq("status", "open").gte("due_at", tomorrow.toISOString()); break;
    case "overdue": query = query.eq("status", "open").lt("due_at", start.toISOString()); break;
    case "completed": query = query.eq("status", "completed"); break;
    case "all": query = query.eq("status", "open"); break;
  }
  if (params.date) {
    const { start: dayStart, end: dayEnd } = taskLocalDateBounds(params.date, params.timeZone);
    query = query.gte("due_at", dayStart.toISOString()).lt("due_at", dayEnd.toISOString());
  }
  if (params.priority !== "all") query = query.eq("priority", params.priority);
  if (params.type !== "all") query = query.eq("task_type", params.type);
  if (params.q) {
    const term = escapeTaskSearchTerm(params.q);
    query = query.or(`title.ilike."%${term}%",description.ilike."%${term}%"`);
  }
  query = params.sort === "title"
    ? query.order("title", { ascending: true }).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    : query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  query = query.range((params.page - 1) * taskPageSize, params.page * taskPageSize - 1);
  const [result, ownersResult] = await Promise.all([
    query,
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  if (result.error || ownersResult.error) throw new Error("Unable to load workspace tasks.");
  const raw = result.data ?? [];
  const relations = await loadTaskRelations(supabase, workspaceId, raw);
  const tasks: TaskRow[] = raw.map((task) => ({ ...task, relation: task.related_entity_id && task.related_entity_type ? relations.get(`${task.related_entity_type}:${task.related_entity_id}`) ?? null : null })) as TaskRow[];
  const owners = formatTaskOwners(ownersResult.data ?? [], userId);
  return { tasks, owners, matchedCount: result.count ?? 0 };
}

export async function listTaskCalendarRecords(supabase: Supabase, { workspaceId, userId, canReassign, params, calendarMonth, now = new Date() }: {
  workspaceId: string; userId: string; canReassign: boolean; params: TaskSearchParams; calendarMonth: string; now?: Date;
}) {
  const [year, month] = calendarMonth.split("-").map(Number);
  const start = taskLocalDateBounds(`${calendarMonth}-01`, params.timeZone).start;
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const end = taskLocalDateBounds(`${nextMonth}-01`, params.timeZone).start;
  const { view } = canReassign ? params : restrictAllTasksView(params);
  const { start: today, tomorrow } = taskDateBounds(now, params.timezoneOffset, params.tomorrowTimezoneOffset);
  let query = supabase.from("tasks").select("due_at").eq("workspace_id", workspaceId).not("due_at", "is", null)
    .gte("due_at", start.toISOString()).lt("due_at", end.toISOString());
  if (!canReassign) query = query.eq("assigned_to", userId);
  switch (view) {
    case "my": query = query.eq("assigned_to", userId).eq("status", "open"); break;
    case "today": query = query.eq("status", "open").gte("due_at", today.toISOString()).lt("due_at", tomorrow.toISOString()); break;
    case "upcoming": query = query.eq("status", "open").gte("due_at", tomorrow.toISOString()); break;
    case "overdue": query = query.eq("status", "open").lt("due_at", today.toISOString()); break;
    case "completed": query = query.eq("status", "completed"); break;
    case "all": query = query.eq("status", "open"); break;
  }
  if (params.priority !== "all") query = query.eq("priority", params.priority);
  if (params.type !== "all") query = query.eq("task_type", params.type);
  if (params.q) {
    const term = escapeTaskSearchTerm(params.q);
    query = query.or(`title.ilike."%${term}%",description.ilike."%${term}%"`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Unable to load task calendar.");
  return (data ?? []).flatMap(({ due_at }) => due_at ? [new Intl.DateTimeFormat("en-CA", { timeZone: params.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(due_at))] : []);
}

export async function countTaskCompletionSummary(supabase: Supabase, workspaceId: string, userId: string, canReassign: boolean) {
  const countStatus = (status: TaskRow["status"]) => {
    let query = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", status);
    if (!canReassign) query = query.eq("assigned_to", userId);
    return query;
  };
  const [open, completed, cancelled] = await Promise.all([countStatus("open"), countStatus("completed"), countStatus("cancelled")]);
  if (open.error || completed.error || cancelled.error) throw new Error("Unable to load task completion summary.");
  return { open: open.count ?? 0, completed: completed.count ?? 0, cancelled: cancelled.count ?? 0 };
}

async function loadTaskRelations(supabase: Supabase, workspaceId: string, tasks: Array<{ related_entity_type: string | null; related_entity_id: string | null }>) {
  const byType = new Map<string, string[]>();
  for (const task of tasks) if (task.related_entity_type && task.related_entity_id) {
    byType.set(task.related_entity_type, [...(byType.get(task.related_entity_type) ?? []), task.related_entity_id]);
  }
  const queries = await Promise.all([
    load("company", "companies", "id,name", (row: { id: string; name: string }) => row.name),
    load("contact", "contacts", "id,first_name,last_name", (row: { id: string; first_name: string; last_name: string }) => `${row.first_name} ${row.last_name}`.trim()),
    load("lead", "leads", "id,full_name", (row: { id: string; full_name: string }) => row.full_name),
    load("deal", "deals", "id,title", (row: { id: string; title: string }) => row.title),
  ]);
  const entries = queries.flatMap((items) => items);
  return new Map(entries.map((item) => [`${item.type}:${item.id}`, item]));

  async function load(type: TaskRelation["type"], table: "companies" | "contacts" | "leads" | "deals", columns: string, label: (record: never) => string): Promise<TaskRelation[]> {
    const ids = [...new Set(byType.get(type) ?? [])];
    if (!ids.length) return [];
    let query = supabase.from(table).select(columns).eq("workspace_id", workspaceId).in("id", ids);
    query = query.is("archived_at", null);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load task relations.");
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((record) => ({ id: String(record.id), type, label: label(record as never) }));
  }
}

export async function listTaskOptions(supabase: Supabase, workspaceId: string, userId: string, canReassign: boolean): Promise<TaskOption[]> {
  const [companies, contacts, leads, deals] = await Promise.all([
    supabase.from("companies").select("id,name,owner_id").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
    supabase.from("contacts").select("id,first_name,last_name,owner_id").eq("workspace_id", workspaceId).is("archived_at", null).order("first_name"),
    canReassign ? supabase.from("leads").select("id,full_name").eq("workspace_id", workspaceId).is("archived_at", null).order("full_name") : Promise.resolve({ data: [], error: null }),
    canReassign ? supabase.from("deals").select("id,title").eq("workspace_id", workspaceId).is("archived_at", null).eq("status", "open").order("title") : Promise.resolve({ data: [], error: null }),
  ]);
  if (companies.error || contacts.error || leads.error || deals.error) throw new Error("Unable to load task options.");
  const allowedCompanies = (companies.data ?? []).filter((row) => canReassign || row.owner_id === userId).map((row) => ({ id: row.id, type: "company" as const, label: row.name }));
  const allowedContacts = (contacts.data ?? []).filter((row) => canReassign || row.owner_id === userId).map((row) => ({ id: row.id, type: "contact" as const, label: `${row.first_name} ${row.last_name}`.trim() }));
  return [...allowedCompanies, ...allowedContacts, ...(leads.data ?? []).map((row) => ({ id: row.id, type: "lead" as const, label: row.full_name })), ...(deals.data ?? []).map((row) => ({ id: row.id, type: "deal" as const, label: row.title }))];
}
