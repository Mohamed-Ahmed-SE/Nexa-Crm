import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isWorkspaceRole } from "@/lib/auth/permissions";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { deriveWorkspaceContext, selectActiveWorkspace, type WorkspaceContext } from "@/lib/auth/workspace-context";

export const workspaceCookieName = "nexa-workspace";

export { deriveWorkspaceContext };
export type { WorkspaceContext };

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: authResult, error: authError } = await supabase.auth.getUser();
  throwIfAuthVerificationFailed(authError);
  const user = authResult.user;
  if (!user) return null;

  const cookieStore = await cookies();
  const selectedWorkspaceId = cookieStore.get(workspaceCookieName)?.value;
  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("user_id, workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (membershipError) throw new Error("Unable to verify workspace membership.");
  if (!memberships?.length) return null;

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .in("id", memberships.map(({ workspace_id }) => workspace_id));
  if (workspaceError) throw new Error("Unable to verify workspace access.");
  const selection = selectActiveWorkspace(user.id, memberships, workspaces ?? [], selectedWorkspaceId);
  if (!selection) return null;
  const availableWorkspaces = memberships
    .filter(({ user_id, status, role }) => user_id === user.id && status === "active" && isWorkspaceRole(role))
    .flatMap(({ workspace_id }) => {
      const available = workspaces?.find(({ id }) => id === workspace_id);
      return available ? [available] : [];
    });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, date_format, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("Unable to load the current profile.");

  const workspace = workspaces?.find(({ id }) => id === selection.workspace.id) ?? null;
  return deriveWorkspaceContext(user, selection.membership, workspace, profile, availableWorkspaces);
}
