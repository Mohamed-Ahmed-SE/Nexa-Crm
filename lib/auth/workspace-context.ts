import { isWorkspaceRole, type WorkspaceRole } from "@/lib/auth/permissions";
import { normalizeDateFormat, type DateFormat } from "@/lib/preferences/date-format";

export type WorkspaceContext = {
  userId: string;
  email: string;
  fullName: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  dateFormat: DateFormat;
  avatarUrl: string | null;
  workspaces: Workspace[];
};

type AuthenticatedUser = { id: string; email?: string };
export type ActiveMembership = { user_id: string; workspace_id: string; role: string; status: string };
export type Workspace = { id: string; name: string };
type Profile = { full_name: string | null; date_format: string | null; avatar_url: string | null } | null;

export function selectActiveWorkspace(
  userId: string,
  memberships: ActiveMembership[],
  workspaces: Workspace[],
  selectedWorkspaceId: string | undefined,
): { membership: ActiveMembership; workspace: Workspace } | null {
  const validMemberships = memberships.filter((membership) =>
    membership.user_id === userId && membership.status === "active" && isWorkspaceRole(membership.role));
  const candidates = validMemberships.flatMap((membership) => {
    const workspace = workspaces.find(({ id }) => id === membership.workspace_id);
    return workspace ? [{ membership, workspace }] : [];
  });
  return candidates.find(({ workspace }) => workspace.id === selectedWorkspaceId) ?? candidates[0] ?? null;
}

export function deriveWorkspaceContext(
  user: AuthenticatedUser,
  membership: ActiveMembership | null,
  workspace: Workspace | null,
  profile: Profile,
  workspaces: Workspace[] = workspace ? [workspace] : [],
): WorkspaceContext | null {
  if (!membership || membership.user_id !== user.id || membership.status !== "active") return null;
  if (!isWorkspaceRole(membership.role) || !workspace || workspace.id !== membership.workspace_id) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name?.trim() || user.email || "Nexa user",
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: membership.role,
    dateFormat: normalizeDateFormat(profile?.date_format),
    avatarUrl: profile?.avatar_url ?? null,
    workspaces,
  };
}
