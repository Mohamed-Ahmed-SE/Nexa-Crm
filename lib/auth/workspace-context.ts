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
};

type AuthenticatedUser = { id: string; email?: string };
type Membership = { user_id: string; workspace_id: string; role: string; status: string };
type Workspace = { id: string; name: string };
type Profile = { full_name: string | null; date_format: string | null; avatar_url: string | null } | null;

export function deriveWorkspaceContext(
  user: AuthenticatedUser,
  membership: Membership | null,
  workspace: Workspace | null,
  profile: Profile,
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
  };
}
