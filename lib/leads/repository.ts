import "server-only";

import type { LeadSearchParams } from "@/lib/leads/schema";
import { buildLeadSearchFilter, leadPageSize } from "@/lib/leads/schema";
import { parsePersistedLeadView, type LeadViewSort } from "@/lib/leads/saved-view-schema";

export type LeadSource = { id: string; name: string };
export type LeadOwner = { id: string; label: string };
export type LeadRow = {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  source_id: string | null;
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  owner_id: string | null;
  estimated_value: number;
  currency: string;
  notes_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadDetail = { lead: LeadRow; source: string | null; ownerLabel: string | null };

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

type LeadDetailContext = { workspaceId: string; userId: string; fullName: string; id: string };

async function getLeadSourceName(supabase: Supabase, workspaceId: string, sourceId: string | null) {
  if (!sourceId) return null;
  const { data, error } = await supabase.from("lead_sources").select("name")
    .eq("workspace_id", workspaceId).eq("id", sourceId).maybeSingle();
  if (error) throw new Error("Unable to load this lead's source.");
  return data?.name ?? null;
}

async function getLeadOwnerLabel(supabase: Supabase, { workspaceId, userId, fullName, ownerId }: {
  workspaceId: string; userId: string; fullName: string; ownerId: string | null;
}) {
  if (!ownerId) return "Unassigned";
  const { data, error } = await supabase.rpc("list_reassignable_workspace_members", {
    target_workspace_id: workspaceId,
    target_user_id: null,
    target_lead_id: null,
  });
  if (error) throw new Error("Unable to load this lead's owner.");
  const workspaceMembers = (data ?? []) as Array<{ user_id: string }>;
  if (!workspaceMembers.some(({ user_id }) => user_id === ownerId)) return null;
  return ownerId === userId ? fullName : `Workspace member · ${ownerId.slice(0, 6)}`;
}

export async function getLeadDetail(supabase: Supabase, context: LeadDetailContext): Promise<LeadDetail | null> {
  const { workspaceId, id } = context;
  const leadResult = await supabase.from("leads")
    .select("id, full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, currency, notes_summary, created_at, updated_at")
    .eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).maybeSingle();
  if (leadResult.error) throw new Error("Unable to load this lead.");
  if (!leadResult.data) return null;

  const lead = leadResult.data as LeadRow;
  const [source, ownerLabel] = await Promise.all([
    getLeadSourceName(supabase, workspaceId, lead.source_id),
    getLeadOwnerLabel(supabase, { ...context, ownerId: lead.owner_id }),
  ]);
  return { lead, source, ownerLabel };
}

export type LeadConversionStage = { id: string; name: string };
export type LeadConversionPipeline = { id: string; name: string; stages: LeadConversionStage[] };
export type LeadConversionOptions = { pipelineId: string; pipelines: LeadConversionPipeline[] };

export async function getLeadConversionOptions(
  supabase: NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>,
  workspaceId: string,
): Promise<LeadConversionOptions> {
  const { data: pipelineRows, error: pipelineError } = await supabase.from("pipelines")
    .select("id, name, is_default").eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false }).order("name");
  if (pipelineError) throw new Error("Unable to load the workspace pipelines.");
  if (!pipelineRows?.length) return { pipelineId: "", pipelines: [] };

  const { data: stageRows, error: stagesError } = await supabase.from("pipeline_stages")
    .select("id, name, pipeline_id").eq("workspace_id", workspaceId)
    .in("pipeline_id", pipelineRows.map(({ id }) => id)).eq("is_active", true).eq("stage_type", "open").order("position");
  if (stagesError) throw new Error("Unable to load workspace pipeline stages.");
  const pipelines = pipelineRows.map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    stages: (stageRows ?? []).filter((stage) => stage.pipeline_id === pipeline.id).map(({ id, name }) => ({ id, name })),
  }));
  return { pipelineId: pipelineRows.find(({ is_default }) => is_default)?.id ?? pipelineRows[0].id, pipelines };
}

export type LeadPageData = {
  leads: LeadRow[];
  totalCount: number;
  matchedCount: number;
  newCount: number;
  qualifiedCount: number;
  sources: LeadSource[];
  owners: LeadOwner[];
  currency: string;
};

export async function listWorkspaceLeads(
  supabase: NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>,
  workspaceId: string,
  currentUserId: string,
  currentUserName: string,
  params: LeadSearchParams,
): Promise<LeadPageData> {
  const start = (params.page - 1) * leadPageSize;
  let recordsQuery = supabase
    .from("leads")
    .select("id, full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, currency, notes_summary, created_at, updated_at", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order(leadSortColumn(params.sort), { ascending: params.sort.endsWith("_asc") })
    .range(start, start + leadPageSize - 1);

  if (params.status !== "all") recordsQuery = recordsQuery.eq("status", params.status);
  if (params.sourceId) recordsQuery = recordsQuery.eq("source_id", params.sourceId);
  if (params.ownerId === "unassigned") recordsQuery = recordsQuery.is("owner_id", null);
  else if (params.ownerId) recordsQuery = recordsQuery.eq("owner_id", params.ownerId);
  const searchFilter = buildLeadSearchFilter(params.q);
  if (searchFilter) recordsQuery = recordsQuery.or(searchFilter);

  const ownersPromise = supabase.rpc("list_reassignable_workspace_members", {
    target_workspace_id: workspaceId,
    target_user_id: null,
    target_lead_id: null,
  });
  const [recordsResult, totalResult, newResult, qualifiedResult, sourcesResult, ownersResult, workspaceResult] = await Promise.all([
    recordsQuery,
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "new").is("archived_at", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "qualified").is("archived_at", null),
    supabase.from("lead_sources").select("id, name").eq("workspace_id", workspaceId).eq("is_active", true).order("name"),
    ownersPromise,
    supabase.from("workspaces").select("default_currency").eq("id", workspaceId).maybeSingle(),
  ]);
  if (recordsResult.error || totalResult.error || newResult.error || qualifiedResult.error || sourcesResult.error || ownersResult.error || workspaceResult.error) {
    throw new Error("Unable to load leads for this workspace.");
  }

  const sources = sourcesResult.data ?? [];
  const owners = (ownersResult.data ?? []).map(({ user_id }: { user_id: string }) => ({
    id: user_id,
    label: user_id === currentUserId ? currentUserName : `Workspace member · ${user_id.slice(0, 6)}`,
  }));

  return {
    leads: (recordsResult.data ?? []) as LeadRow[],
    totalCount: totalResult.count ?? 0,
    matchedCount: recordsResult.count ?? 0,
    newCount: newResult.count ?? 0,
    qualifiedCount: qualifiedResult.count ?? 0,
    sources,
    owners,
    currency: workspaceResult.data?.default_currency ?? "USD",
  };
}

function leadSortColumn(sort: LeadViewSort): "updated_at" | "full_name" | "estimated_value" {
  if (sort.startsWith("name_")) return "full_name";
  if (sort.startsWith("value_")) return "estimated_value";
  return "updated_at";
}

export type LeadSavedView = {
  id: string;
  name: string;
  filters: { q: string; status: LeadSearchParams["status"]; sourceId: string; ownerId: string };
  sort: LeadViewSort;
  visibleColumns: import("@/lib/leads/saved-view-schema").LeadViewColumn[];
};

export async function listLeadSavedViews(
  supabase: Parameters<typeof listWorkspaceLeads>[0],
  workspaceId: string,
  userId: string,
): Promise<LeadSavedView[]> {
  const { data, error } = await supabase.from("saved_views")
    .select("id, name, filters, sort, visible_columns")
    .eq("workspace_id", workspaceId).eq("user_id", userId).eq("entity_type", "leads")
    .order("name");
  if (error) throw new Error("Unable to load saved lead views.");
  return (data ?? []).flatMap((row) => {
    const parsed = parsePersistedLeadView(row);
    return parsed ? [{ id: row.id, name: row.name, ...parsed }] : [];
  });
}

export async function getLeadForEdit(supabase: Parameters<typeof listWorkspaceLeads>[0], workspaceId: string, id: string) {
  return supabase.from("leads")
    .select("id, full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, notes_summary, currency")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
}

export async function saveLead(
  supabase: Parameters<typeof listWorkspaceLeads>[0],
  workspaceId: string,
  userId: string,
  input: {
    id?: string;
    fullName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    sourceId: string | null;
    status: "new" | "contacted" | "qualified" | "unqualified";
    ownerId: string | null;
    estimatedValue: number;
    notesSummary: string | null;
    currency?: string;
  },
) {
  const values = {
    full_name: input.fullName,
    company_name: input.companyName,
    email: input.email,
    phone: input.phone,
    job_title: input.jobTitle,
    source_id: input.sourceId,
    status: input.status,
    owner_id: input.ownerId,
    estimated_value: input.estimatedValue,
    notes_summary: input.notesSummary,
  };
  if (input.id) {
    return supabase.from("leads").update(values).eq("workspace_id", workspaceId).eq("id", input.id).is("archived_at", null).select("id").maybeSingle();
  }
  return supabase.from("leads").insert({
    workspace_id: workspaceId,
    created_by: userId,
    currency: input.currency ?? "USD",
    ...values,
  }).select("id").maybeSingle();
}
