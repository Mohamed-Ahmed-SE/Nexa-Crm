import { notFound } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { getCompanyDetail, listCompanyOptions } from "@/lib/companies/repository";
import { companyIdSchema } from "@/lib/companies/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CompanyDetailWorkspace } from "../companies-workspace";

export default async function CompanyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = companyIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const [detail, options] = await Promise.all([
    getCompanyDetail(supabase, context.workspaceId, parsedId.data),
    listCompanyOptions(supabase, context.workspaceId, context.userId, context.fullName),
  ]);
  if (!detail) notFound();
  const canEdit = hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && detail.company.owner_id === context.userId);
  return <CompanyDetailWorkspace detail={detail} owners={options.owners} section={typeof query.section === "string" ? query.section : "overview"} canEdit={canEdit}
    canReassign={hasWorkspacePermission(context.role, "crm.reassign")} canArchive={hasWorkspacePermission(context.role, "crm.archive")} currentUserId={context.userId} startEditing={query.edit === "1"} />;
}
