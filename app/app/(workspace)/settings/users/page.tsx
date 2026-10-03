import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceAccessManager, type WorkspaceInviteRow, type WorkspaceMemberRow } from "@/components/auth/workspace-access-manager";
import { requirePermission } from "@/lib/auth/authorize";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WorkspaceUsersPage() {
  const context = await requirePermission("users.manage");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Authentication is not configured.");

  const [membersResult, invitesResult] = await Promise.all([
    supabase.rpc("list_workspace_members", { target_workspace_id: context.workspaceId }),
    supabase.rpc("list_workspace_invites", { target_workspace_id: context.workspaceId }),
  ]);
  if (membersResult.error || invitesResult.error) throw new Error("Workspace access data could not be loaded.");

  const invites = ((invitesResult.data ?? []) as Omit<WorkspaceInviteRow, "expired">[]).map((invite) => ({
    ...invite,
    expired: Date.parse(invite.expires_at) <= Date.now(),
  }));

  return (
    <div className="page-container">
      <PageHeader description="Manage who can use this workspace and the access they have." title="Workspace access" />
      <WorkspaceAccessManager
        currentUserId={context.userId}
        invites={invites}
        members={(membersResult.data ?? []) as WorkspaceMemberRow[]}
      />
    </div>
  );
}
