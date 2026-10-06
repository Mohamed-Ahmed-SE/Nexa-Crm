import { redirect } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { listWorkspaceCompanies } from "@/lib/companies/repository";
import { parseCompanySearchParams } from "@/lib/companies/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CompaniesWorkspace } from "./companies-workspace";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const params = parseCompanySearchParams(await searchParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const result = await listWorkspaceCompanies(supabase, context.workspaceId, context.userId, context.fullName, params);
  const lastPage = Math.max(1, Math.ceil(result.matchedCount / 25));
  if (params.page > lastPage) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.ownerId) query.set("owner", params.ownerId);
    query.set("page", String(lastPage));
    redirect(`/app/companies?${query.toString()}`);
  }
  return <CompaniesWorkspace companies={result.companies} matchedCount={result.matchedCount} totalCount={result.totalCount} owners={result.owners} search={params.q} ownerId={params.ownerId} page={params.page}
    canCreate={hasWorkspacePermission(context.role, "crm.create")} canImport={hasWorkspacePermission(context.role, "data.import")} canExport={hasWorkspacePermission(context.role, "data.export")} canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")} canEditOwn={hasWorkspacePermission(context.role, "crm.edit.own")} currentUserId={context.userId} />;
}
