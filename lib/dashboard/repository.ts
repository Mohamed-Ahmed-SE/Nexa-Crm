import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardActivity, DashboardDeal, DashboardTask, WorkspaceDashboardData } from "@/lib/dashboard/types";
import { dashboardDateKey, dashboardDateStart } from "@/lib/dashboard/calendar";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type Row = Record<string, unknown>;

export class DashboardUnavailableError extends Error {
  constructor() {
    super("Workspace dashboard data is unavailable.");
    this.name = "DashboardUnavailableError";
  }
}
const joined = (relationValue: unknown): Row | null => {
  const relation = Array.isArray(relationValue) ? relationValue[0] : relationValue;
  return relation && typeof relation === "object" ? relation as Row : null;
};
const text = (fieldValue: unknown, fallback = "") => typeof fieldValue === "string" ? fieldValue : fallback;
const optionalText = (fieldValue: unknown) => typeof fieldValue === "string" ? fieldValue : null;
const label = (fieldValue: unknown, fallback: string) => text(fieldValue).trim() ? text(fieldValue) : fallback;
const stageType = (stageTypeValue: unknown): "open" | "won" | "lost" => stageTypeValue === "won" || stageTypeValue === "lost" ? stageTypeValue : "open";

type DashboardRows = { deals: Row[]; stages: Row[]; leads: Row[]; tasks: Row[]; activities: Row[]; dealActivities: Row[]; ownerLabels: Row[] };
type DashboardBuildOptions = { workspaceId: string; currency: string; timeZone: string; today: string; rows: DashboardRows };
type DashboardQueryOptions = { workspaceId: string; now: Date; today: string; timeZone: string };
type DashboardLabelQuery = { workspaceId: string; type: "company" | "contact" | "lead"; table: "companies" | "contacts" | "leads"; columns: string; ids: string[] };

export async function loadWorkspaceDashboard(supabase: Supabase, workspaceId: string, now = new Date()): Promise<WorkspaceDashboardData> {
  const workspace = await supabase.from("workspaces").select("default_currency,timezone").eq("id", workspaceId).maybeSingle();
  if (workspace.error || !workspace.data) throw new DashboardUnavailableError();
  const timeZone = workspace.data.timezone;
  const today = dashboardDateKey(now, timeZone);
  const rows = await loadDashboardRows(supabase, { workspaceId, now, today, timeZone });
  return buildWorkspaceDashboard(supabase, { workspaceId, currency: workspace.data.default_currency, timeZone, today, rows });
}

async function loadDashboardRows(supabase: Supabase, options: DashboardQueryOptions): Promise<DashboardRows> {
  const { workspaceId, now, today, timeZone } = options;
  const monthStart = dashboardDateStart(`${today.slice(0, 7)}-01`, timeZone).toISOString();
  const since14Days = new Date(now.valueOf() - 14 * 86_400_000).toISOString();
  const [deals, stages, leads, tasks, activities, dealActivities, ownerLabels] = await Promise.all([
    supabase.from("deals").select("id,title,amount,currency,status,expected_close_date,created_at,won_at,stage_id,pipeline_id,owner_id,pipeline_stages(name,stage_type),pipelines(name),companies(name),contacts(first_name,last_name),lead_sources(name)").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("pipeline_stages").select("id,pipeline_id,name,position,stage_type,pipelines(name)").eq("workspace_id", workspaceId).eq("is_active", true).order("position"),
    supabase.from("leads").select("id,created_at,lead_sources(name)").eq("workspace_id", workspaceId).is("archived_at", null).gte("created_at", monthStart).lte("created_at", now.toISOString()),
    supabase.from("tasks").select("id,title,due_at,priority,related_entity_type,related_entity_id,status").eq("workspace_id", workspaceId).eq("status", "open").not("due_at", "is", null).order("due_at"),
    supabase.from("activities").select("id,subject,activity_type,occurred_at,related_entity_type,related_entity_id").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(8),
    supabase.from("activities").select("related_entity_id,occurred_at").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").gte("occurred_at", since14Days).lte("occurred_at", now.toISOString()),
    supabase.rpc("get_workspace_report_member_labels", { target_workspace_id: workspaceId }),
  ]);
  if (deals.error || stages.error || leads.error || tasks.error || activities.error || dealActivities.error || ownerLabels.error) throw new DashboardUnavailableError();
  return {
    deals: (deals.data ?? []) as Row[], stages: (stages.data ?? []) as Row[], leads: (leads.data ?? []) as Row[],
    tasks: (tasks.data ?? []) as Row[], activities: (activities.data ?? []) as Row[], dealActivities: (dealActivities.data ?? []) as Row[],
    ownerLabels: (ownerLabels.data ?? []) as Row[],
  };
}

async function buildWorkspaceDashboard(supabase: Supabase, options: DashboardBuildOptions): Promise<WorkspaceDashboardData> {
  const dealActivity = latestDealActivities(options.rows.dealActivities);
  const ownerLabels = new Map(options.rows.ownerLabels.map((row) => [text(row.user_id), text(row.display_name)]));
  const deals = options.rows.deals.map((row) => mapDeal(row, ownerLabels, dealActivity));
  const relatedRows = [...options.rows.activities, ...options.rows.tasks];
  const relationLabels = await loadActivityLabels(supabase, options.workspaceId, relatedRows, deals);
  return {
    currency: options.currency, timeZone: options.timeZone, deals,
    stages: options.rows.stages.map(mapStage), leads: options.rows.leads.map(mapLead),
    tasks: options.rows.tasks.map((row) => mapTask(row, relationLabels, deals)),
    activities: options.rows.activities.map((row) => mapActivity(row, relationLabels, deals)), today: options.today,
  };
}

function latestDealActivities(events: Row[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const event of events) {
    const dealId = text(event.related_entity_id);
    const occurredAt = text(event.occurred_at);
    const previous = latest.get(dealId);
    if (dealId && occurredAt && (!previous || occurredAt > previous)) latest.set(dealId, occurredAt);
  }
  return latest;
}

function mapStage(row: Row) {
  return { id: text(row.id), name: text(row.name), pipelineId: text(row.pipeline_id), pipelineName: label(joined(row.pipelines)?.name, "Pipeline"), position: Number(row.position ?? 0), stageType: stageType(row.stage_type) };
}

function mapLead(row: Row) {
  return { id: text(row.id), createdAt: text(row.created_at), source: text(joined(row.lead_sources)?.name, "Unspecified") };
}

function mapDeal(row: Row, ownerLabels: Map<string, string>, dealActivity: Map<string, string>): DashboardDeal {
  const id = text(row.id);
  const ownerId = optionalText(row.owner_id);
  const status = stageType(row.status);
  return {
    id, ...dealLabels(row),
    stageId: text(row.stage_id), pipelineId: text(row.pipeline_id), stageType: stageType(joined(row.pipeline_stages)?.stage_type ?? row.status),
    amount: Number(row.amount ?? 0), currency: text(row.currency), owner: ownerId ? ownerLabels.get(ownerId) ?? "Workspace member" : "Unassigned",
    expectedCloseDate: optionalText(row.expected_close_date), createdAt: text(row.created_at), lastActivityAt: dealActivity.get(id) ?? null,
    wonAt: optionalText(row.won_at), status,
  };
}

function dealLabels(row: Row) {
  const stage = joined(row.pipeline_stages);
  const company = joined(row.companies);
  const contact = joined(row.contacts);
  const source = joined(row.lead_sources);
  return {
    title: text(row.title, "Untitled deal"), company: optionalText(company?.name),
    contact: contact ? `${text(contact.first_name)} ${text(contact.last_name)}`.trim() || null : null,
    stage: label(stage?.name, "Unassigned stage"), source: text(source?.name, "Unspecified"),
  };
}

function mapTask(row: Row, relationLabels: Map<string, string>, deals: DashboardDeal[]): DashboardTask {
  const type = optionalText(row.related_entity_type);
  const id = optionalText(row.related_entity_id);
  const relatedTo = type && id ? relationLabels.get(`${type}:${id}`) ?? deals.find((deal) => deal.id === id)?.title ?? null : null;
  return {
    id: text(row.id), title: text(row.title), dueAt: text(row.due_at), priority: text(row.priority), relatedTo,
    relatedId: type === "deal" ? id : null,
    relatedHref: type && id ? `/app/${type === "deal" ? "deals" : `${type}s`}/${id}` : null,
  };
}

function mapActivity(row: Row, relationLabels: Map<string, string>, deals: DashboardDeal[]): DashboardActivity {
  const type = optionalText(row.related_entity_type);
  const id = optionalText(row.related_entity_id);
  const relatedTo = type && id ? relationLabels.get(`${type}:${id}`) ?? deals.find((deal) => deal.id === id)?.title ?? null : null;
  return {
    id: text(row.id),
    subject: label(row.subject, `${label(row.activity_type, "Activity")} recorded`),
    kind: text(row.activity_type),
    occurredAt: text(row.occurred_at),
    relatedTo,
    relatedHref: type && id ? `/app/${type === "deal" ? "deals" : `${type}s`}/${id}` : null,
  };
}

async function loadActivityLabels(supabase: Supabase, workspaceId: string, relatedRows: Row[], deals: DashboardDeal[]) {
  const idsByType = new Map<string, string[]>();
  for (const row of relatedRows) {
    const type = text(row.related_entity_type);
    const id = optionalText(row.related_entity_id);
    if (!id || (type !== "company" && type !== "contact" && type !== "lead" && type !== "deal")) continue;
    idsByType.set(type, [...(idsByType.get(type) ?? []), id]);
  }
  const labels = new Map<string, string>();
  for (const deal of deals) labels.set(`deal:${deal.id}`, deal.title);
  const [companies, contacts, leads] = await Promise.all([
    loadLabels(supabase, { workspaceId, type: "company", table: "companies", columns: "id,name", ids: idsByType.get("company") ?? [] }),
    loadLabels(supabase, { workspaceId, type: "contact", table: "contacts", columns: "id,first_name,last_name", ids: idsByType.get("contact") ?? [] }),
    loadLabels(supabase, { workspaceId, type: "lead", table: "leads", columns: "id,full_name", ids: idsByType.get("lead") ?? [] }),
  ]);
  for (const entry of [...companies, ...contacts, ...leads]) labels.set(`${entry.type}:${entry.id}`, entry.label);
  return labels;
}

async function loadLabels(supabase: Supabase, query: DashboardLabelQuery) {
  const { workspaceId, type, table, columns, ids } = query;
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [] as Array<{ type: string; id: string; label: string }>;
  const labelsQuery = await supabase.from(table).select(columns).eq("workspace_id", workspaceId).in("id", uniqueIds).is("archived_at", null);
  if (labelsQuery.error) throw new DashboardUnavailableError();
  return ((labelsQuery.data ?? []) as unknown as Row[]).map((row) => ({
    type,
    id: text(row.id),
    label: type === "contact" ? `${text(row.first_name)} ${text(row.last_name)}`.trim() : text(row.name ?? row.full_name),
  }));
}
