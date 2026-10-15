import { notFound } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { getLeadDetail } from "@/lib/leads/repository";
import { leadIdSchema } from "@/lib/leads/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeadDetailWorkspace } from "../lead-detail-workspace";

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = leadIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const detail = await getLeadDetail(supabase, { workspaceId: context.workspaceId, userId: context.userId, fullName: context.fullName, id: parsedId.data });
  if (!detail) notFound();
  return <LeadDetailWorkspace
    canEdit={hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && detail.lead.owner_id === context.userId)}
    canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")}
    currentUserId={context.userId}
    canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
    detail={detail}
    createNoteIntent={query.createNote === "1"}
    createTaskIntent={query.createTask === "1"}
  />;
}
