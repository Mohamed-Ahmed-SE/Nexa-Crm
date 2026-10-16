import "server-only";

import { inactiveOwnerLabel, listInactiveWorkspaceMemberIds } from "@/lib/workspace/inactive-owner-labels";
import { listEntityTags, replaceEntityTags, listWorkspaceTags as listWorkspaceEntityTags } from "@/lib/tags/entity-tags";

import { buildDealSearchFilter, type DealSearchParams } from "@/lib/deals/schema";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

export type DealStage = { id: string; pipeline_id: string; name: string; position: number; probability: number; stage_type: "open" | "won" | "lost"; color_token: string | null };
export type DealOwner = { id: string; label: string };
export type DealTag = { id: string; name: string; color_token: string | null };
export type DealRelation = { name: string } | null;
type DealRelationFields = { name?: string; full_name?: string; first_name?: string; last_name?: string };

function relationName(relation: DealRelationFields | DealRelationFields[] | null): DealRelation {
  const related = Array.isArray(relation) ? relation[0] : relation;
  const name = related?.name ?? related?.full_name ?? [related?.first_name, related?.last_name].filter(Boolean).join(" ");
  return name ? { name } : null;
}
export type DealRow = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  title: string;
  company_id: string | null;
  primary_contact_id: string | null;
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  owner_id: string | null;
  ownerLabel?: string;
  priority: "low" | "medium" | "high";
  description: string | null;
  status: "open" | "won" | "lost";
  created_at: string;
  company: DealRelation;
  contact: DealRelation;
  tags?: DealTag[];
};
export type DealOption = { id: string; name: string };
export type DealsData = {
  deals: DealRow[];
  tags: DealTag[];
  stages: DealStage[];
  pipelines: DealOption[];
  companies: DealOption[];
  contacts: Array<DealOption & { company_id: string | null }>;
  owners: DealOwner[];
  pipelineId: string;
};

export async function listWorkspaceTags(supabase: Supabase, workspaceId: string): Promise<DealTag[]> {
  return listWorkspaceEntityTags(supabase, workspaceId);
}

export async function listDealTagsByEntityIds(supabase: Supabase, workspaceId: string, dealIds: string[]) {
  return listEntityTags(supabase, workspaceId, "deal", dealIds);
}

export async function replaceDealTags(supabase: Supabase, workspaceId: string, dealId: string, tagIds: string[]) {
  return replaceEntityTags(supabase, workspaceId, "deal", dealId, tagIds);
}

export async function listWorkspaceDeals(supabase: Supabase, workspaceId: string, userId: string, userName: string, params: DealSearchParams): Promise<DealsData> {
  const [pipelinesResult, companyResult, contactResult, ownerResult] = await Promise.all([
    supabase.from("pipelines").select("id, name, is_default").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("name"),
    supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("name").limit(500),
    supabase.from("contacts").select("id, first_name, last_name, company_id").eq("workspace_id", workspaceId).is("archived_at", null).order("first_name").order("last_name").limit(500),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  if (pipelinesResult.error || companyResult.error || contactResult.error || ownerResult.error) throw new Error("Unable to load Deals workspace options.");

  const pipelines = (pipelinesResult.data ?? []).map(({ id, name }: { id: string; name: string }) => ({ id, name }));
  const pipelineId = params.pipelineId === "all" ? "all" : pipelines.some(({ id }) => id === params.pipelineId) ? params.pipelineId : pipelinesResult.data?.find(({ is_default }: { is_default: boolean }) => is_default)?.id ?? pipelines[0]?.id ?? "";
  const stageQuery = supabase.from("pipeline_stages").select("id, pipeline_id, name, position, probability, stage_type, color_token").eq("workspace_id", workspaceId).eq("is_active", true).order("position");
  const stagesResult = pipelineId === "all"
    ? await stageQuery
    : pipelineId ? await stageQuery.eq("pipeline_id", pipelineId) : { data: [], error: null };
  if (stagesResult.error) throw new Error("Unable to load pipeline stages.");
  const stages = (stagesResult.data ?? []) as DealStage[];
  let dealsQuery = supabase.from("deals").select("id, pipeline_id, stage_id, title, company_id, primary_contact_id, amount, currency, probability, expected_close_date, owner_id, priority, description, status, created_at, company:companies!deals_workspace_id_company_id_fkey(name), primary_contact:contacts!deals_workspace_id_primary_contact_id_fkey(first_name,last_name)")
    .eq("workspace_id", workspaceId).is("archived_at", null).order("updated_at", { ascending: false });
  if (pipelineId !== "all") dealsQuery = dealsQuery.eq("pipeline_id", pipelineId);
  if (params.status !== "all") dealsQuery = dealsQuery.eq("status", params.status);
  if (params.wonFrom) dealsQuery = dealsQuery.gte("won_at", params.wonFrom);
  if (params.wonTo) dealsQuery = dealsQuery.lt("won_at", params.wonTo);
  if (params.ownerId === "unassigned") dealsQuery = dealsQuery.is("owner_id", null);
  else if (params.ownerId) dealsQuery = dealsQuery.eq("owner_id", params.ownerId);
  const filter = buildDealSearchFilter(params.q);
  if (filter) dealsQuery = dealsQuery.or(filter);
  const deals: DealRow[] = [];
  if (pipelineId) {
    for (let page = 0; ; page += 1) {
      const result = await dealsQuery.range(page * 1000, page * 1000 + 999);
      if (result.error) throw new Error("Unable to load Deals for this workspace.");
      deals.push(...(result.data ?? []).map(({ primary_contact, ...row }) => ({ ...row, company: relationName(row.company), contact: relationName(primary_contact) }) as unknown as DealRow));
      if ((result.data?.length ?? 0) < 1000) break;
    }
  }

  const [workspaceTags, tagsByDeal] = await Promise.all([
    listWorkspaceTags(supabase, workspaceId),
    listDealTagsByEntityIds(supabase, workspaceId, deals.map(({ id }) => id)),
  ]);
  for (const deal of deals) deal.tags = tagsByDeal.get(deal.id) ?? [];

  const memberRows = (ownerResult.data ?? []) as Array<{ user_id: string }>;
  const ownerIds: string[] = [...new Set(memberRows.map(({ user_id }) => user_id))];
  const profilesResult = ownerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [], error: null };
  if (profilesResult.error) throw new Error("Unable to load deal owners.");
  const profileRows = (profilesResult.data ?? []) as Array<{ id: string; full_name: string | null }>;
  const names = new Map<string, string | null>(profileRows.map(({ id, full_name }) => [id, full_name]));
  const owners = ownerIds.map((id) => ({ id, label: id === userId ? userName : names.get(id) || "Workspace member" }));
  const inactiveOwnerIds = await listInactiveWorkspaceMemberIds(supabase, workspaceId, deals.map(({ owner_id }) => owner_id));
  for (const deal of deals) if (deal.owner_id && inactiveOwnerIds.has(deal.owner_id)) {
    deal.ownerLabel = inactiveOwnerLabel(`Workspace member · ${deal.owner_id.slice(0, 6)}`);
  }
  return {
    deals, tags: workspaceTags, stages, pipelines, owners,
    companies: (companyResult.data ?? []) as DealOption[],
    contacts: (contactResult.data ?? []).map(({ id, first_name, last_name, company_id }: { id: string; first_name: string; last_name: string; company_id: string | null }) => ({ id, name: `${first_name} ${last_name}`, company_id })),
    pipelineId,
  };
}

export type DealDetail = {
  deal: {
    id: string; pipeline_id: string; stage_id: string; title: string; company_id: string | null; primary_contact_id: string | null;
    amount: number; currency: string; probability: number; expected_close_date: string | null; owner_id: string | null;
    source_id: string | null; priority: "low" | "medium" | "high"; description: string | null; status: "open" | "won" | "lost";
    created_at: string; updated_at: string;
  };
  company: { id: string; name: string } | null;
  contact: { id: string; full_name: string } | null;
  stage: { id: string; name: string; stage_type: "open" | "won" | "lost" } | null;
  pipeline: { id: string; name: string } | null;
  ownerLabel: string;
  source: string | null;
  tags: DealTag[];
  lostReasons: Array<{ id: string; name: string }>;
  openStages: Array<{ id: string; name: string; position: number }>;
  activities: Array<{ id: string; activity_type: string; subject: string | null; body: string | null; occurred_at: string; created_by: string; is_system_event: boolean }>;
  tasks: Array<{ id: string; title: string; description: string | null; task_type: string; status: string; priority: string; due_at: string | null; assigned_to: string | null }>;
  notes: Array<{ id: string; body: string; created_by: string; author: string; created_at: string; updated_at: string; is_pinned: boolean }>;
  attachments: Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>;
};

type DealRelationships = Pick<DealDetail, "company" | "contact" | "stage" | "pipeline" | "source">;

async function getDealRelationships(supabase: Supabase, workspaceId: string, deal: DealDetail["deal"]): Promise<DealRelationships> {
  const [company, contact, stage, pipeline, source] = await Promise.all([
    deal.company_id ? supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).eq("id", deal.company_id).is("archived_at", null).maybeSingle() : Promise.resolve({ data: null, error: null }),
    deal.primary_contact_id ? supabase.from("contacts").select("id, first_name, last_name").eq("workspace_id", workspaceId).eq("id", deal.primary_contact_id).is("archived_at", null).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("pipeline_stages").select("id, name, stage_type").eq("workspace_id", workspaceId).eq("pipeline_id", deal.pipeline_id).eq("id", deal.stage_id).maybeSingle(),
    supabase.from("pipelines").select("id, name").eq("workspace_id", workspaceId).eq("id", deal.pipeline_id).maybeSingle(),
    deal.source_id ? supabase.from("lead_sources").select("name").eq("workspace_id", workspaceId).eq("id", deal.source_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (company.error || contact.error || stage.error || pipeline.error || source.error) throw new Error("Unable to load deal relationships.");
  return {
    company: company.data,
    contact: contact.data ? { id: contact.data.id, full_name: `${contact.data.first_name} ${contact.data.last_name}` } : null,
    stage: stage.data as DealDetail["stage"], pipeline: pipeline.data, source: source.data?.name ?? null,
  };
}

async function getWorkspaceOwnerIds(supabase: Supabase, workspaceId: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null });
  if (error) throw new Error("Unable to load deal owners.");
  return new Set(((data ?? []) as Array<{ user_id: string }>).map(({ user_id }) => user_id));
}

async function getDealOwnerLabel(supabase: Supabase, workspaceId: string, ownerId: string | null, workspaceOwnerIds: Set<string>): Promise<string> {
  if (!ownerId) return "Unassigned";
  const inactiveOwnerIds = await listInactiveWorkspaceMemberIds(supabase, workspaceId, [ownerId]);
  if (inactiveOwnerIds.has(ownerId)) return inactiveOwnerLabel(`Workspace member · ${ownerId.slice(0, 6)}`);
  if (!workspaceOwnerIds.has(ownerId)) return "Workspace member";
  const { data, error } = await supabase.from("profiles").select("id, full_name").eq("id", ownerId).maybeSingle();
  if (error) throw new Error("Unable to load this deal's owner.");
  return data?.full_name || "Workspace member";
}

export async function getDealDetail(supabase: Supabase, workspaceId: string, id: string): Promise<DealDetail | null> {
  const dealResult = await supabase.from("deals").select("id, pipeline_id, stage_id, title, company_id, primary_contact_id, amount, currency, probability, expected_close_date, owner_id, source_id, priority, description, status, created_at, updated_at")
    .eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).maybeSingle();
  if (dealResult.error) throw new Error("Unable to load this deal.");
  if (!dealResult.data) return null;
  const deal = dealResult.data as DealDetail["deal"];
  const [relationships, workspaceOwnerIds, lostReasonResult, stagesResult, activitiesResult, tasksResult, notesResult, attachmentsResult, tagsByDeal] = await Promise.all([
    getDealRelationships(supabase, workspaceId, deal),
    getWorkspaceOwnerIds(supabase, workspaceId),
    supabase.from("lost_reasons").select("id, name").eq("workspace_id", workspaceId).eq("is_active", true).order("name"),
    supabase.from("pipeline_stages").select("id, name, position").eq("workspace_id", workspaceId).eq("pipeline_id", deal.pipeline_id).eq("is_active", true).eq("stage_type", "open").order("position"),
    supabase.from("activities").select("id, activity_type, subject, body, occurred_at, created_by, is_system_event").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", id).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("tasks").select("id, title, description, task_type, status, priority, due_at, assigned_to").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", id).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    supabase.from("notes").select("id, body, created_by, created_at, updated_at, is_pinned").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50),
    supabase.from("attachments").select("id, filename, mime_type, size_bytes, created_at").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", id).order("created_at", { ascending: false }).limit(50),
    listDealTagsByEntityIds(supabase, workspaceId, [id]),
  ]);
  if (lostReasonResult.error || stagesResult.error || activitiesResult.error || tasksResult.error || notesResult.error || attachmentsResult.error) throw new Error("Unable to load deal engagement history.");
  const notes = (notesResult.data ?? []) as Array<Omit<DealDetail["notes"][number], "author">>;
  const authorIds = [...new Set(notes.map(({ created_by }) => created_by))];
  const authorResult = authorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [], error: null };
  if (authorResult.error) throw new Error("Unable to load deal note authors.");
  const authorNames = new Map(((authorResult.data ?? []) as Array<{ id: string; full_name: string | null }>).map(({ id, full_name }) => [id, full_name]));
  return {
    deal, ...relationships, ownerLabel: await getDealOwnerLabel(supabase, workspaceId, deal.owner_id, workspaceOwnerIds),
    tags: tagsByDeal.get(id) ?? [],
    lostReasons: (lostReasonResult.data ?? []) as DealDetail["lostReasons"],
    openStages: (stagesResult.data ?? []) as DealDetail["openStages"],
    activities: (activitiesResult.data ?? []) as DealDetail["activities"],
    tasks: (tasksResult.data ?? []) as DealDetail["tasks"],
    notes: notes.map((note) => ({ ...note, author: authorNames.get(note.created_by) || "Workspace member" })),
    attachments: (attachmentsResult.data ?? []) as DealDetail["attachments"],
  };
}

export async function getDealForEdit(supabase: Supabase, workspaceId: string, id: string) {
  return supabase.from("deals").select("id, pipeline_id, stage_id, title, company_id, primary_contact_id, amount, currency, expected_close_date, owner_id, priority, description, status")
    .eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).maybeSingle();
}

export async function insertDeal(supabase: Supabase, workspaceId: string, userId: string, pipelineId: string, stageId: string, currency: string, input: {
  title: string; companyId: string | null; contactId: string | null; amount: number; expectedCloseDate: string | null; ownerId: string | null; priority: "low" | "medium" | "high"; description: string | null;
}) {
  return supabase.from("deals").insert({ workspace_id: workspaceId, created_by: userId, pipeline_id: pipelineId, stage_id: stageId, currency,
    title: input.title, company_id: input.companyId, primary_contact_id: input.contactId, amount: input.amount,
    expected_close_date: input.expectedCloseDate, owner_id: input.ownerId, priority: input.priority, description: input.description,
  }).select("id").maybeSingle();
}

export async function updateDeal(supabase: Supabase, workspaceId: string, id: string, input: {
  title: string; companyId: string | null; contactId: string | null; amount: number; expectedCloseDate: string | null; ownerId: string | null; priority: "low" | "medium" | "high"; description: string | null;
}) {
  return supabase.from("deals").update({ title: input.title, company_id: input.companyId, primary_contact_id: input.contactId,
    amount: input.amount, expected_close_date: input.expectedCloseDate, owner_id: input.ownerId, priority: input.priority, description: input.description,
  }).eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).select("id").maybeSingle();
}
