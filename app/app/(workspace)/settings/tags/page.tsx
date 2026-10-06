import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TagManager, type WorkspaceTag } from "./tag-manager";

export default async function WorkspaceTagsPage() {
  const context = await requirePermission("workspace.manage");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Authentication is not configured.");

  const { data: tags, error } = await supabase.from("tags").select("id,name,color_token").eq("workspace_id", context.workspaceId).order("name");
  if (error) throw new Error("Workspace tags could not be loaded.");

  return (
    <div className="page-container">
      <PageHeader description="Create and maintain the tags used across this workspace." title="Tags" />
      <TagManager tags={(tags ?? []) as WorkspaceTag[]} />
    </div>
  );
}
