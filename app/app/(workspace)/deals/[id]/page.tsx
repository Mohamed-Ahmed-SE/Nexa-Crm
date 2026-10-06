import { notFound } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { getDealDetail } from "@/lib/deals/repository";
import { dealIdSchema } from "@/lib/deals/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DealDetailWorkspace } from "./deal-detail-workspace";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("crm.view");
  const { id } = await params;
  const parsedId = dealIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const detail = await getDealDetail(supabase, context.workspaceId, parsedId.data);
  if (!detail) notFound();
  const canEdit = hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && detail.deal.owner_id === context.userId);
  return <DealDetailWorkspace canEdit={canEdit} detail={detail} />;
}
