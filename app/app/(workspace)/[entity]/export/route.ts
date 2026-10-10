import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { parseLeadSearchParams, buildLeadSearchFilter } from "@/lib/leads/schema";
import { parseContactSearchParams } from "@/lib/contacts/schema";
import { parseCompanySearchParams, escapeCompanySearchTerm } from "@/lib/companies/schema";
import { parseDealSearchParams, buildDealSearchFilter } from "@/lib/deals/schema";
import { escapeTaskSearchTerm, parseTaskSearchParams, taskDateBounds } from "@/lib/tasks/schema";
import { formatTaskOwners } from "@/lib/tasks/owner-labels";
import { serializeCsv } from "@/lib/csv/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const csvColumns = {
  leads: { headers: ["Name", "Company", "Email", "Phone", "Job title", "Source", "Status", "Owner ID", "Estimated value", "Currency", "Notes", "Created at", "Updated at"], keys: ["full_name", "company_name", "email", "phone", "job_title", "source_name", "status", "owner_id", "estimated_value", "currency", "notes_summary", "created_at", "updated_at"] },
  contacts: { headers: ["First name", "Last name", "Email", "Phone", "Job title", "Company", "Owner ID", "Lifecycle", "LinkedIn URL", "Created at", "Updated at"], keys: ["first_name", "last_name", "email", "phone", "job_title", "company_name", "owner_id", "lifecycle_status", "linkedin_url", "created_at", "updated_at"] },
  companies: { headers: ["Name", "Website", "Industry", "Employee size", "Phone", "Address line 1", "Address line 2", "City", "State", "Postal code", "Country", "Description", "Owner ID", "Created at", "Updated at"], keys: ["name", "website", "industry", "employee_size", "phone", "address_line_1", "address_line_2", "city", "state", "postal_code", "country", "description", "owner_id", "created_at", "updated_at"] },
  deals: { headers: ["Deal", "Company", "Primary contact", "Pipeline", "Stage", "Amount", "Currency", "Probability", "Expected close date", "Owner ID", "Priority", "Status", "Description", "Created at", "Updated at"], keys: ["title", "company_name", "contact_name", "pipeline_name", "stage_name", "amount", "currency", "probability", "expected_close_date", "owner_id", "priority", "status", "description", "created_at", "updated_at"] },
  tasks: { headers: ["Title", "Description", "Type", "Status", "Priority", "Due date", "Assignee", "Related type", "Related record"], keys: ["title", "description", "task_type", "status", "priority", "due_at", "assignee_name", "related_entity_type", "relation_label"] },
} as const;
type Entity = keyof typeof csvColumns;
type DataRow = Record<string, unknown>;

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!Object.hasOwn(csvColumns, entity)) return new Response("Not found", { status: 404 });
  const context = await requirePermission("data.export");
  if (!hasWorkspacePermission(context.role, "crm.view")) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Authentication is not configured.", { status: 503 });
  const filterParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  try {
    const records = entity === "tasks"
      ? await loadTaskExportRows(supabase, context.workspaceId, context.userId, filterParams)
      : await loadExportRows(supabase, context.workspaceId, entity as Entity, filterParams);
    const { headers, keys } = csvColumns[entity as Entity];
    const body = `\uFEFF${serializeCsv([...headers], records.map((record) => keys.map((key) => record[key])))}`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nexa-${entity}-${date}.csv"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("The filtered export could not be prepared.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

async function loadExportRows(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, entity: Entity, raw: Record<string, string>): Promise<DataRow[]> {
  if (entity === "leads") {
    const params = parseLeadSearchParams(raw);
    const matchingTagLeadIds = params.tagId ? await fetchMatchingLeadIdsForTag(supabase, workspaceId, params.tagId) : null;
    if (matchingTagLeadIds?.length === 0) return [];
    return fetchAll((from, to) => {
      let query = supabase.from("leads").select("id, full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, currency, notes_summary, created_at, updated_at, lead_sources(name)").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").order("id").range(from, to);
      if (params.status !== "all") query = query.eq("status", params.status);
      if (matchingTagLeadIds) query = query.in("id", matchingTagLeadIds);
      if (params.sourceId) query = query.eq("source_id", params.sourceId);
      if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
      const filter = buildLeadSearchFilter(params.q); if (filter) query = query.or(filter);
      return query;
    }, (row) => ({ ...row, source_name: Array.isArray(row.lead_sources) ? row.lead_sources[0]?.name ?? "" : (row.lead_sources as { name?: string } | null)?.name ?? "" }));
  }
  if (entity === "contacts") {
    const params = parseContactSearchParams(raw);
    return fetchAll((from, to) => {
      let query = supabase.from("contacts").select("id, first_name, last_name, email, phone, job_title, company_id, companies(name, archived_at), owner_id, lifecycle_status, linkedin_url, created_at, updated_at").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").order("id").range(from, to);
      if (params.lifecycle !== "all") query = query.eq("lifecycle_status", params.lifecycle);
      if (params.companyId) query = query.eq("company_id", params.companyId);
      if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
      return query;
    }, (row) => {
      const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as { name?: string; archived_at?: string | null } | null;
      return { ...row, company_name: company?.name ?? "", company_search_name: company && !company.archived_at ? company.name ?? "" : "" };
    }, params.q ? (row) => hasSearchMatch(row, ["first_name", "last_name", "email", "phone", "job_title", "company_search_name"], params.q) : undefined);
  }
  if (entity === "deals") {
    const params = parseDealSearchParams(raw);
    const pipelines = await fetchAll((from, to) => supabase.from("pipelines").select("id, name").eq("workspace_id", workspaceId).order("id").range(from, to));
    const pipelineNames = new Map(pipelines.map((pipeline) => [String(pipeline.id), String(pipeline.name ?? "")]));
    return fetchAll((from, to) => {
      let query = supabase.from("deals").select("id, pipeline_id, stage_id, title, amount, currency, probability, expected_close_date, owner_id, priority, status, description, created_at, updated_at, companies!deals_workspace_id_company_id_fkey(name), contacts!deals_workspace_id_primary_contact_id_fkey(full_name), pipeline_stages!deals_workspace_id_pipeline_id_stage_id_fkey(name)").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").order("id").range(from, to);
      if (params.pipelineId) query = query.eq("pipeline_id", params.pipelineId);
      if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
      const filter = buildDealSearchFilter(params.q); if (filter) query = query.or(filter);
      return query;
    }, (row) => ({ ...row, company_name: relationLabel(row.companies, "name"), contact_name: relationLabel(row.contacts, "full_name"), stage_name: relationLabel(row.pipeline_stages, "name"), pipeline_name: pipelineNames.get(String(row.pipeline_id)) ?? "" }));
  }
  const params = parseCompanySearchParams(raw);
  const matchingCompanyIds = new Set<string>();
  if (params.q) {
    const term = escapeCompanySearchTerm(params.q);
    const matches = await fetchAll((from, to) => supabase.from("contacts").select("id, company_id").eq("workspace_id", workspaceId).is("archived_at", null).or(`first_name.ilike."%${term}%",last_name.ilike."%${term}%",email.ilike."%${term}%`).order("id").range(from, to));
    for (const match of matches) if (typeof match.company_id === "string") matchingCompanyIds.add(match.company_id);
  }
  return fetchAll((from, to) => {
    let query = supabase.from("companies").select("id, name, website, industry, employee_size, phone, address_line_1, address_line_2, city, state, postal_code, country, description, owner_id, created_at, updated_at").eq("workspace_id", workspaceId).is("archived_at", null).order("name").order("id").range(from, to);
    if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
    return query;
  }, (row) => row, params.q ? (row) => matchingCompanyIds.has(String(row.id)) || hasSearchMatch(row, ["name", "industry", "website", "phone"], params.q) : undefined);
}

async function fetchMatchingLeadIdsForTag(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, tagId: string) {
  const rows = await fetchAll((from, to) => supabase.from("entity_tags").select("entity_id")
    .eq("workspace_id", workspaceId).eq("entity_type", "lead").eq("tag_id", tagId)
    .order("entity_id").range(from, to));
  return [...new Set(rows.map(({ entity_id }) => String(entity_id)))];
}

type TaskExportContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  params: ReturnType<typeof parseTaskSearchParams>;
  start: Date;
  tomorrow: Date;
};
type TaskExportPageContext = TaskExportContext & { offset: number; owners: ReturnType<typeof formatTaskOwners> };

async function loadTaskExportRows(supabase: TaskExportContext["supabase"], workspaceId: string, userId: string, raw: Record<string, string>): Promise<DataRow[]> {
  const params = parseTaskSearchParams(raw);
  const { start, tomorrow } = taskDateBounds(new Date(), params.timezoneOffset, params.tomorrowTimezoneOffset);
  const ownersResult = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null });
  if (ownersResult.error) throw ownersResult.error;
  const context = { supabase, workspaceId, userId, params, start, tomorrow, owners: formatTaskOwners(ownersResult.data ?? [], userId) };
  const exported: DataRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await loadTaskExportPage({ ...context, offset });
    exported.push(...page);
    if (page.length < 1000) return exported;
  }
}

async function loadTaskExportPage(context: TaskExportPageContext): Promise<DataRow[]> {
  const page = await buildTaskExportQuery(context);
  if (page.error) throw page.error;
  const rows = (page.data ?? []) as DataRow[];
  const relations = await loadTaskExportRelations(context.supabase, context.workspaceId, rows);
  return rows.map((row) => formatTaskExportRow(row, relations, context.owners, context.userId));
}

function buildTaskExportQuery({ supabase, workspaceId, userId, params, start, tomorrow, offset }: TaskExportPageContext) {
  let query = supabase.from("tasks").select("id,title,description,task_type,status,priority,due_at,assigned_to,related_entity_type,related_entity_id").eq("workspace_id", workspaceId);
  query = params.sort === "title"
    ? query.order("title", { ascending: true }).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    : query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  query = query.order("id", { ascending: true });
  query = query.range(offset, offset + 999);
  if (params.view === "my") query = query.eq("assigned_to", userId).eq("status", "open");
  else if (params.view === "completed") query = query.eq("status", "completed");
  else {
    query = query.eq("status", "open");
    if (params.view === "today") query = query.gte("due_at", start.toISOString()).lt("due_at", tomorrow.toISOString());
    else if (params.view === "upcoming") query = query.gte("due_at", tomorrow.toISOString());
    else query = query.lt("due_at", start.toISOString());
  }
  if (params.priority !== "all") query = query.eq("priority", params.priority);
  if (params.type !== "all") query = query.eq("task_type", params.type);
  if (params.q) {
    const term = escapeTaskSearchTerm(params.q);
    query = query.or(`title.ilike."%${term}%",description.ilike."%${term}%"`);
  }
  return query;
}

function formatTaskExportRow(row: DataRow, relations: Map<string, string>, owners: ReturnType<typeof formatTaskOwners>, userId: string): DataRow {
  const assignee = owners.find(({ id }) => id === row.assigned_to)?.label
    ?? (row.assigned_to === userId ? "You" : row.assigned_to ? `Workspace member · ${String(row.assigned_to).slice(0, 6)}` : "Unassigned");
  const relationKey = `${row.related_entity_type}:${row.related_entity_id}`;
  return { ...row, assignee_name: assignee, relation_label: relations.get(relationKey) ?? "" };
}

const taskRelationTables = [
  { type: "company", table: "companies", columns: "id,name", label: (row: DataRow) => row.name },
  { type: "contact", table: "contacts", columns: "id,first_name,last_name", label: (row: DataRow) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() },
  { type: "lead", table: "leads", columns: "id,full_name", label: (row: DataRow) => row.full_name },
  { type: "deal", table: "deals", columns: "id,title", label: (row: DataRow) => row.title },
] as const;

async function loadTaskExportRelations(supabase: TaskExportContext["supabase"], workspaceId: string, tasks: DataRow[]) {
  const idsByType = new Map<string, string[]>();
  for (const task of tasks) {
    if (typeof task.related_entity_id !== "string" || typeof task.related_entity_type !== "string") continue;
    idsByType.set(task.related_entity_type, [...(idsByType.get(task.related_entity_type) ?? []), task.related_entity_id]);
  }
  const labels = new Map<string, string>();
  for (const relation of taskRelationTables) {
    const ids = [...new Set(idsByType.get(relation.type) ?? [])];
    if (ids.length) await addTaskRelationLabels(supabase, workspaceId, relation, ids, labels);
  }
  return labels;
}

async function addTaskRelationLabels(supabase: TaskExportContext["supabase"], workspaceId: string, relation: (typeof taskRelationTables)[number], ids: string[], labels: Map<string, string>) {
  const result = await supabase.from(relation.table).select(relation.columns).eq("workspace_id", workspaceId).in("id", ids).is("archived_at", null);
  if (result.error) throw result.error;
  for (const record of (result.data ?? []) as unknown as DataRow[]) labels.set(`${relation.type}:${record.id}`, String(relation.label(record) ?? ""));
}

async function fetchAll(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, transform: (row: DataRow) => DataRow = (row) => row, include: (row: DataRow) => boolean = () => true): Promise<DataRow[]> {
  const result: DataRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await fetchPage(offset, offset + 999);
    if (page.error) throw page.error;
    const rows = (page.data ?? []) as DataRow[];
    for (const row of rows.map(transform)) if (include(row)) result.push(row);
    if (rows.length < 1000) return result;
  }
}

function relationLabel(relation: unknown, field: string): string {
  const related = Array.isArray(relation) ? relation[0] : relation;
  if (!related || typeof related !== "object") return "";
  const label = (related as DataRow)[field];
  return typeof label === "string" ? label : "";
}

function hasSearchMatch(row: DataRow, fields: string[], query: string) {
  const term = query.trim().toLowerCase();
  return fields.some((field) => String(row[field] ?? "").toLowerCase().includes(term));
}
