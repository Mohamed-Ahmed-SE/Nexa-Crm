import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWorkspaceRole } from "@/lib/auth/permissions";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { deriveWorkspaceContext, type WorkspaceContext } from "@/lib/auth/workspace-context";

export { deriveWorkspaceContext };
export type { WorkspaceContext };

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: authResult, error: authError } = await supabase.auth.getUser();
  throwIfAuthVerificationFailed(authError);
  const user = authResult.user;
  if (!user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("user_id, workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new Error("Unable to verify workspace membership.");
  if (!membership || !isWorkspaceRole(membership.role)) return null;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  if (workspaceError) throw new Error("Unable to verify workspace access.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("Unable to load the current profile.");

  return deriveWorkspaceContext(user, membership, workspace, profile);
}
