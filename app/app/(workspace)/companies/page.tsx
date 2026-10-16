import { redirect } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { listCompanySavedViews, listWorkspaceCompanies } from "@/lib/companies/repository";
import { applyCompanySavedView, companyPageSize, companyViewColumns, findCompanySavedView, parseCompanySearchParams } from "@/lib/companies/schema";
import { listWorkspaceTags } from "@/lib/tags/entity-tags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CompaniesWorkspace } from "./companies-workspace";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const rawParams = await searchParams;
  const params = parseCompanySearchParams(rawParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const savedViews = await listCompanySavedViews(supabase, context.workspaceId, context.userId);
  const activeView = findCompanySavedView(rawParams.view, savedViews);
  const activeParams = activeView ? applyCompanySavedView(params, activeView) : params;
  const visibleColumns = activeView?.visibleColumns ?? [...companyViewColumns];
  const [result, tags] = await Promise.all([
    listWorkspaceCompanies(supabase, context.workspaceId, context.userId, context.fullName, activeParams),
    listWorkspaceTags(supabase, context.workspaceId),
  ]);
  const lastPage = Math.max(1, Math.ceil(result.matchedCount / companyPageSize));
  if (activeParams.page > lastPage) {
    const query = new URLSearchParams();
    if (activeParams.q) query.set("q", activeParams.q);
    if (activeParams.ownerId) query.set("owner", activeParams.ownerId);
    if (activeParams.tagId) query.set("tagId", activeParams.tagId);
    if (activeParams.sort !== "name_asc") query.set("sort", activeParams.sort);
    if (activeView) query.set("view", activeView.id);
    query.set("page", String(lastPage));
    redirect(`/app/companies?${query.toString()}`);
  }
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  return <CompaniesWorkspace companies={result.companies} matchedCount={result.matchedCount} totalCount={result.totalCount} owners={result.owners} tags={tags} search={activeParams.q} ownerId={activeParams.ownerId} tagId={activeParams.tagId} sort={activeParams.sort} page={activeParams.page}
    savedViews={savedViews} activeViewId={activeView?.id ?? ""} visibleColumns={visibleColumns} createIntent={canCreate && rawParams.create === "1"}
    canCreate={canCreate} canImport={hasWorkspacePermission(context.role, "data.import")} canExport={hasWorkspacePermission(context.role, "data.export")} canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")} canEditOwn={hasWorkspacePermission(context.role, "crm.edit.own")} currentUserId={context.userId} />;
}
