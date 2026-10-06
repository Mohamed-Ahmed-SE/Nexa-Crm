import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorize";
import { getLeadDetail } from "@/lib/leads/repository";
import { leadIdSchema } from "@/lib/leads/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeadDetailWorkspace } from "../lead-detail-workspace";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("crm.view");
  const { id } = await params;
  const parsedId = leadIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const detail = await getLeadDetail(supabase, { workspaceId: context.workspaceId, userId: context.userId, fullName: context.fullName, id: parsedId.data });
  if (!detail) notFound();
  return <LeadDetailWorkspace detail={detail} />;
}
