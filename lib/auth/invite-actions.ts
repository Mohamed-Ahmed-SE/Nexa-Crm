"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorize";
import { createInviteToken, hashInviteToken, isValidInviteToken } from "@/lib/auth/invite-token";
import { workspaceRoles } from "@/lib/auth/permissions";
import { safeInternalPath } from "@/lib/auth/validation";
import type { InviteActionState, MemberActionState } from "@/lib/auth/member-actions";
import { getSupabaseEnvironment } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(workspaceRoles),
});
const tokenSchema = z.string().refine(isValidInviteToken, "Invalid invitation link.");

function getFormValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function createWorkspaceInviteAction(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const context = await requirePermission("users.manage");
  const parsed = inviteSchema.safeParse({
    email: getFormValue(formData, "email"),
    role: getFormValue(formData, "role"),
  });
  if (!parsed.success) return { message: "Enter a valid email and invitation role." };

  const environment = getSupabaseEnvironment();
  const supabase = await createSupabaseServerClient();
  if (!environment || !supabase) return { message: "Authentication is not configured." };

  const token = createInviteToken();
  const { error } = await supabase.rpc("create_workspace_invite", {
    target_workspace_id: context.workspaceId,
    invite_email: parsed.data.email,
    invite_role: parsed.data.role,
    invite_token_hash: hashInviteToken(token),
  });
  if (error?.code === "23505") {
    return { message: "A pending invitation for this email already exists. Revoke it before creating another." };
  }
  if (error?.code === "23514") return { message: "This account already belongs to this workspace." };
  if (error) return { message: "The invitation could not be created. Check your admin access and try again." };

  revalidatePath("/app/settings/users");
  const link = new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}`, environment.siteUrl);
  return {
    ok: true,
    message: "Invitation created. Copy and share this link securely; it will not be shown again.",
    inviteLink: link.toString(),
  };
}

export async function revokeWorkspaceInviteAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const context = await requirePermission("users.manage");
  const inviteId = z.string().uuid().safeParse(getFormValue(formData, "inviteId"));
  if (!inviteId.success) return { message: "Invalid invitation." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: revoked, error } = await supabase.rpc("revoke_workspace_invite", {
    target_workspace_id: context.workspaceId,
    target_invite_id: inviteId.data,
  });
  if (error) return { message: "The invitation could not be revoked." };
  if (!revoked) return { message: "This invitation is no longer pending." };

  revalidatePath("/app/settings/users");
  return { ok: true, message: "Invitation revoked." };
}

export async function signOutForInviteAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Unable to sign out. Please try again.");
  }
  redirect(safeInternalPath(getFormValue(formData, "next"), "/auth/sign-in"));
}

export async function acceptWorkspaceInviteAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsedToken = tokenSchema.safeParse(getFormValue(formData, "token"));
  if (!parsedToken.success) return { message: "This invitation link is invalid." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) return { message: "Sign in with the invited account before accepting this invitation." };

  const { error } = await supabase.rpc("accept_workspace_invite", {
    invite_token_hash: hashInviteToken(parsedToken.data),
  });
  if (error?.code === "42501") return { message: "Sign in with the email address that received this invitation." };
  if (error?.code === "22023") return { message: "This invitation has expired or was already used. Ask an administrator for a new link." };
  if (error?.code === "23514") return { message: "This account already belongs to the workspace." };
  if (error) return { message: "This invitation could not be accepted. Ask an administrator to check its status." };

  redirect("/app/dashboard");
}
