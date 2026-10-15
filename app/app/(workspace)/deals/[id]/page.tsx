import { notFound } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { getDealDetail } from "@/lib/deals/repository";
import { dealIdSchema } from "@/lib/deals/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DealDetailWorkspace } from "./deal-detail-workspace";

export default async function DealDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = dealIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const detail = await getDealDetail(supabase, context.workspaceId, parsedId.data);
  if (!detail) notFound();
  const canEdit = hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && detail.deal.owner_id === context.userId);
  const canArchive = hasWorkspacePermission(context.role, "crm.archive");
  return <DealDetailWorkspace canArchive={canArchive} canEdit={canEdit} canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")} canManageAllActivities={context.role === "admin"} currentUserId={context.userId} createNoteIntent={query.createNote === "1"} createTaskIntent={query.createTask === "1"} detail={detail} />;
}
