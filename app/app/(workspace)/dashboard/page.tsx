import { requirePermission } from "@/lib/auth/authorize";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { DashboardUnavailableError, loadWorkspaceDashboard } from "@/lib/dashboard/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardWorkspace } from "./dashboard-workspace";

export default async function DashboardPage() {
  const context = await requirePermission("crm.view");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <DashboardWorkspace state="unavailable" canCreate={false} />;

  try {
    const dashboardData = await loadWorkspaceDashboard(supabase, context.workspaceId);
    return <DashboardWorkspace state="ready" canCreate={hasWorkspacePermission(context.role, "crm.create")} dashboard={dashboardData} />;
  } catch (error) {
    if (!(error instanceof DashboardUnavailableError)) throw error;
    return <DashboardWorkspace state="unavailable" canCreate={hasWorkspacePermission(context.role, "crm.create")} />;
  }
}
