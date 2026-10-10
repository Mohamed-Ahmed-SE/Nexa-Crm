import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WorkspaceSettingsForm } from "./workspace-settings-form";

export default async function WorkspaceSettingsPage() {
  const context = await requirePermission("workspace.manage");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Authentication is not configured.");

  const { data: workspace, error } = await supabase.from("workspaces")
    .select("name,logo_url,default_currency,timezone")
    .eq("id", context.workspaceId)
    .maybeSingle();
  if (error || !workspace) throw new Error("Workspace settings could not be loaded.");

  return (
    <div className="page-container">
      <PageHeader description="Update the name, logo, currency, and timezone for this workspace." title="Workspace settings" />
      <WorkspaceSettingsForm settings={{
        name: workspace.name,
        logoUrl: workspace.logo_url,
        defaultCurrency: workspace.default_currency,
        timezone: workspace.timezone,
      }} />
    </div>
  );
}
