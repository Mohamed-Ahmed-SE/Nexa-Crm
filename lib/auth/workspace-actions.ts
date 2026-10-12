"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isWorkspaceRole } from "@/lib/auth/permissions";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { workspaceCookieName } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const workspaceIdSchema = z.string().uuid();
type WorkspaceSwitchState = { error: string | null };
function rejectedSwitchState(): WorkspaceSwitchState {
  return { error: "Workspace switch failed. Your current workspace is unchanged. Refresh and try again." };
}

export async function switchWorkspaceAction(
  _previousState: WorkspaceSwitchState,
  formData: FormData,
): Promise<WorkspaceSwitchState> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  if (!parsedWorkspaceId.success) return rejectedSwitchState();

  const supabase = await createSupabaseServerClient();
  if (!supabase) return rejectedSwitchState();
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  throwIfAuthVerificationFailed(authError);
  if (!authResult.user) return rejectedSwitchState();

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, status")
    .eq("user_id", authResult.user.id)
    .eq("workspace_id", parsedWorkspaceId.data)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Unable to verify workspace membership.");
  if (!membership || !isWorkspaceRole(membership.role)) return rejectedSwitchState();

  const cookieStore = await cookies();
  cookieStore.set(workspaceCookieName, membership.workspace_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/app/dashboard");
}
