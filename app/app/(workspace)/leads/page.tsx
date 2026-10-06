import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { parseLeadSearchParams } from "@/lib/leads/schema";
import { leadSavedViewIdSchema, leadViewColumns } from "@/lib/leads/saved-view-schema";
import { getLeadConversionOptions, listLeadSavedViews, listWorkspaceLeads } from "@/lib/leads/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeadWorkspace } from "./lead-workspace";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const rawParams = await searchParams;
  const params = parseLeadSearchParams(rawParams);
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const canConvert = hasWorkspacePermission(context.role, "crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <LeadsLoadError />;
  const [savedViews, conversionOptions] = await Promise.all([
    listLeadSavedViews(supabase, context.workspaceId, context.userId),
    canConvert ? getLeadConversionOptions(supabase, context.workspaceId) : Promise.resolve({ pipelineId: "", pipelines: [] }),
  ]);
  const requestedView = leadSavedViewIdSchema.safeParse(rawParams.view);
  const activeView = requestedView.success ? savedViews.find((view) => view.id === requestedView.data) : undefined;
  const activeParams = activeView ? {
    ...params, ...activeView.filters, sort: activeView.sort, page: 1,
  } : params;
  const visibleColumns = activeView?.visibleColumns ?? [...leadViewColumns];
  const data = await listWorkspaceLeads(
    supabase,
    context.workspaceId,
    context.userId,
    context.fullName,
    activeParams,
  );
  return <LeadWorkspace
    canCreate={canCreate}
    canImport={hasWorkspacePermission(context.role, "data.import")}
    canExport={hasWorkspacePermission(context.role, "data.export")}
    createIntent={canCreate && rawParams.create === "1"}
    canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")}
    canConvert={canConvert}
    conversionOptions={conversionOptions}
    canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
    currentUserId={context.userId}
    currency={data.currency}
    leads={data.leads}
    matchedCount={data.matchedCount}
    newCount={data.newCount}
    ownerFilter={activeParams.ownerId}
    owners={data.owners}
    page={activeParams.page}
    qualifiedCount={data.qualifiedCount}
    search={activeParams.q}
    sourceFilter={activeParams.sourceId}
    sources={data.sources}
    statusFilter={activeParams.status}
    sort={activeParams.sort}
    visibleColumns={visibleColumns}
    savedViews={savedViews}
    activeViewId={activeView?.id ?? ""}
    totalCount={data.totalCount}
  />;
}

function LeadsLoadError() {
  return <main className="page-container leads-page"><header className="leads-header"><div><h1 className="page-title">Leads</h1><p className="page-description">Track, qualify, and manage prospective customers in this workspace.</p></div></header><section className="leads-error" role="alert"><h2>Leads could not be loaded</h2><p>Check your connection and reload this page. Your workspace records have not been changed.</p></section></main>;
}
