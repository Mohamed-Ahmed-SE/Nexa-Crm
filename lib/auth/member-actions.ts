"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorize";
import { workspaceRoles } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const memberChangeSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(workspaceRoles).optional(),
  status: z.enum(["active", "deactivated"]).optional(),
}).refine((change) => Boolean(change.role) !== Boolean(change.status));
export type MemberActionState = { message: string; ok?: boolean };
export type InviteActionState = MemberActionState & { inviteLink?: string };

export async function updateWorkspaceMember(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const context = await requirePermission("users.manage");
  const parsed = memberChangeSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role") || undefined,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid member update." };
  if (parsed.data.memberId === context.userId) return { ok: false, message: "You cannot change your own workspace access." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured." };
  const changes = parsed.data.role ? { role: parsed.data.role } : { status: parsed.data.status! };
  const { data: updated, error } = await supabase
    .from("workspace_members")
    .update(changes)
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", context.workspaceId)
    .select("id")
    .maybeSingle();
  if (error?.code === "23514") return { ok: false, message: "A workspace must retain at least one active administrator." };
  if (error) return { ok: false, message: "Member access could not be updated." };
  if (!updated) return { ok: false, message: "Workspace member not found." };
  revalidatePath("/app/settings/users");
  return { ok: true, message: "Workspace member updated." };
}
