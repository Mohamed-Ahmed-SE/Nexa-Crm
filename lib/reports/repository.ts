import "server-only";

import { inactiveOwnerLabel, listInactiveWorkspaceMemberIds } from "@/lib/workspace/inactive-owner-labels";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { nextUtcDate, type ReportFilters } from "@/lib/reports/schema";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type ReportOwner = { id: string; name: string };
export type ReportPipeline = { id: string; name: string };
export type ReportData = {
  currency: string;
  summary: { won_revenue: number; total_deal_value: number; total_deals: number; won_count: number; lost_count: number; average_deal_value: number };
  revenue_trend: Array<{ month: string; amount: number; deals: number }>;
  pipeline_by_stage: Array<{ pipeline_id: string; pipeline: string; stage_id: string; name: string; position: number; deals: number; amount: number }>;
  pipeline_by_owner: Array<{ owner_id: string | null; owner: string; deals: number; amount: number }>;
  deals_by_source: Array<{ source_id: string | null; name: string; deals: number; amount: number }>;
  lead_source_performance: Array<{ source_id: string | null; name: string; leads: number; estimated_value: number }>;
  tasks: { completed: number; overdue: number };
  deal_conversion_funnel: Array<{ pipeline_id: string; pipeline: string; stage_id: string; name: string; position: number; deals: number }>;
  activity_by_rep: Array<{ owner_id: string | null; name: string; activities: number }>;
  top_deals: Array<{ id: string; title: string; company: string | null; owner: string; stage: string | null; amount: number; created_at: string; status: "open" | "won" | "lost" }>;
  outcomes: { won: number; lost: number; open: number };
};

export async function loadWorkspaceReport(supabase: Supabase, workspaceId: string, filters: ReportFilters) {
  const [workspaceResult, pipelinesResult, ownerResult, labelResult] = await Promise.all([
    supabase.from("workspaces").select("default_currency").eq("id", workspaceId).maybeSingle(),
    supabase.from("pipelines").select("id,name,is_default").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("name"),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
    supabase.rpc("get_workspace_report_member_labels", { target_workspace_id: workspaceId }),
  ]);
  if (workspaceResult.error || pipelinesResult.error || ownerResult.error || labelResult.error || !workspaceResult.data) throw new Error("Unable to load report filters.");
  const pipelines = (pipelinesResult.data ?? []).map(({ id, name }: { id: string; name: string }) => ({ id, name })) as ReportPipeline[];
  const ownerRows = (ownerResult.data ?? []) as Array<{ user_id: string }>;
  const labelRows = (labelResult.data ?? []) as Array<{ user_id: string; display_name: string }>;
  const inactiveOwnerIds = await listInactiveWorkspaceMemberIds(supabase, workspaceId, labelRows.map(({ user_id }) => user_id));
  const labelsById = new Map(labelRows.map(({ user_id, display_name }) => [user_id, inactiveOwnerIds.has(user_id) ? inactiveOwnerLabel(display_name) : display_name]));
  const owners: ReportOwner[] = ownerRows.map(({ user_id }) => ({
    id: user_id,
    name: labelsById.get(user_id) ?? `Member · ${user_id.slice(0, 8)}`,
  }));
  const selectedPipeline = pipelines.some(({ id }) => id === filters.pipelineId) ? filters.pipelineId : "all";
  const selectedOwner = owners.some(({ id }) => id === filters.ownerId) ? filters.ownerId : "all";
  const dataResult = await supabase.rpc("get_workspace_report", {
    target_workspace_id: workspaceId,
    target_start: `${filters.start}T00:00:00.000Z`,
    target_end: nextUtcDate(filters.end),
    target_owner_id: selectedOwner === "all" ? null : selectedOwner,
    target_pipeline_id: selectedPipeline === "all" ? null : selectedPipeline,
  });
  if (dataResult.error || !dataResult.data) throw new Error("Unable to load report data.");
  const report = dataResult.data as unknown as ReportData;
  report.pipeline_by_owner = report.pipeline_by_owner.map((row) => ({
    ...row,
    owner: row.owner_id ? labelsById.get(row.owner_id) ?? row.owner : row.owner,
  }));
  report.activity_by_rep = report.activity_by_rep.map((row) => ({
    ...row,
    name: row.owner_id ? labelsById.get(row.owner_id) ?? row.name : row.name,
  }));
  if (report.top_deals.length) {
    const { data: dealOwnerRows, error: dealOwnerError } = await supabase.from("deals").select("id,owner_id")
      .eq("workspace_id", workspaceId).in("id", report.top_deals.map(({ id }) => id));
    if (dealOwnerError) throw new Error("Unable to verify top deal owners.");
    const ownerIdByDealId = new Map(((dealOwnerRows ?? []) as Array<{ id: string; owner_id: string | null }>)
      .map(({ id, owner_id }) => [id, owner_id] as const));
    report.top_deals = report.top_deals.map((row) => {
      const ownerId = ownerIdByDealId.get(row.id);
      return { ...row, owner: ownerId && inactiveOwnerIds.has(ownerId) ? inactiveOwnerLabel(row.owner) : row.owner };
    });
  }
  return {
    report,
    owners,
    pipelines,
    filters: {
      ...filters,
      ownerId: selectedOwner,
      pipelineId: selectedPipeline,
      invalid: filters.invalid || (filters.ownerId !== "all" && selectedOwner === "all") || (filters.pipelineId !== "all" && selectedPipeline === "all"),
    },
    currency: workspaceResult.data.default_currency,
  };
}
