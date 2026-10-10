import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PipelineStageManager, type WorkspacePipeline, type WorkspacePipelineStage } from "./pipeline-stage-manager";

export default async function PipelineSettingsPage() {
  const context = await requirePermission("workspace.manage");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Authentication is not configured.");

  const [{ data: pipelines, error: pipelineError }, { data: stages, error: stageError }] = await Promise.all([
    supabase.from("pipelines").select("id,name").eq("workspace_id", context.workspaceId).order("created_at"),
    supabase.from("pipeline_stages").select("id,pipeline_id,name,position,probability,stage_type,is_active").eq("workspace_id", context.workspaceId).order("position"),
  ]);
  if (pipelineError || stageError) throw new Error("Pipeline stages could not be loaded.");

  return (
    <div className="page-container">
      <PageHeader description="Rename, reorder, and set default probability for active open stages. Disable an open stage only after its open deals are moved or closed; Won and Lost stages remain required." title="Pipeline stages" />
      <PipelineStageManager pipelines={(pipelines ?? []) as WorkspacePipeline[]} stages={(stages ?? []) as WorkspacePipelineStage[]} />
    </div>
  );
}
