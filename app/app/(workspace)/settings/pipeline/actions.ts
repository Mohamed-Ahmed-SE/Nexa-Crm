"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { createPipelineStageSchema, pipelineStageIdSchema, renamePipelineStageSchema, reorderPipelineStagesSchema, updatePipelineStageProbabilitySchema } from "@/lib/pipeline-stages/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PipelineStageActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };

function formString(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function revalidatePipelineSettings() {
  revalidatePath("/app/settings");
  revalidatePath("/app/settings/pipeline");
  revalidatePath("/app/deals");
}

function mutationMessage(errorCode: string | undefined, operation: "create" | "rename" | "reorder") {
  if (errorCode === "23505") return "A stage with that name already exists in this pipeline.";
  if (errorCode === "22023") return "The stages changed in another session. Refresh and try again.";
  if (errorCode === "42501") return "Only workspace admins can manage pipeline stages.";
  if (operation === "create") return "Unable to create this stage. Try again.";
  return operation === "rename" ? "Unable to rename this stage. Try again." : "Unable to save this stage order. Try again.";
}

export async function createPipelineStageAction(_previous: PipelineStageActionState, form: FormData): Promise<PipelineStageActionState> {
  await requirePermission("workspace.manage");
  const parsed = createPipelineStageSchema.safeParse({ pipelineId: formString(form, "pipelineId"), name: formString(form, "name"), probability: formString(form, "probability") });
  if (!parsed.success) return { message: "Check the stage name and default probability and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { error } = await supabase.rpc("create_pipeline_stage", { target_pipeline_id: parsed.data.pipelineId, target_name: parsed.data.name, target_probability: parsed.data.probability });
  if (error) return { message: mutationMessage(error.code, "create") };
  revalidatePipelineSettings();
  return { ok: true, message: "Stage created." };
}

export async function renamePipelineStageAction(_previous: PipelineStageActionState, form: FormData): Promise<PipelineStageActionState> {
  await requirePermission("workspace.manage");
  const parsed = renamePipelineStageSchema.safeParse({ stageId: formString(form, "stageId"), name: formString(form, "name") });
  if (!parsed.success) return { message: "Check the stage name and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { error } = await supabase.rpc("rename_pipeline_stage", { target_stage_id: parsed.data.stageId, target_name: parsed.data.name });
  if (error) return { message: mutationMessage(error.code, "rename") };
  revalidatePipelineSettings();
  return { ok: true, message: "Stage renamed." };
}

export async function deactivatePipelineStageAction(_previous: PipelineStageActionState, form: FormData): Promise<PipelineStageActionState> {
  await requirePermission("workspace.manage");
  const parsed = pipelineStageIdSchema.safeParse(formString(form, "stageId"));
  if (!parsed.success) return { message: "Choose a valid stage and try again." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { error } = await supabase.rpc("deactivate_pipeline_stage", { target_stage_id: parsed.data });
  if (error) {
    if (error.code === "PST01") return { message: "This stage still has open deals. Move or close them before disabling it." };
    if (error.code === "PST02") return { message: "This stage is inactive and cannot receive deals." };
    if (error.code === "22023") return { message: "Only an active open stage can be disabled. Refresh and try again." };
    if (error.code === "42501") return { message: "Only workspace admins can manage pipeline stages." };
    return { message: "Unable to disable this stage. Try again." };
  }
  revalidatePipelineSettings();
  return { ok: true, message: "Stage disabled." };
}

export async function updatePipelineStageProbabilityAction(_previous: PipelineStageActionState, form: FormData): Promise<PipelineStageActionState> {
  const context = await requirePermission("workspace.manage");
  const parsed = updatePipelineStageProbabilitySchema.safeParse({ stageId: formString(form, "stageId"), probability: formString(form, "probability") });
  if (!parsed.success) return { message: "Enter a whole-number probability from 0 to 100.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { data: stage, error } = await supabase.from("pipeline_stages").update({ probability: parsed.data.probability }).eq("workspace_id", context.workspaceId).eq("id", parsed.data.stageId).eq("stage_type", "open").eq("is_active", true).select("id").maybeSingle();
  if (error) return { message: "Unable to save this stage probability. Try again." };
  if (!stage) return { message: "This active open stage is no longer available. Refresh and try again." };
  revalidatePipelineSettings();
  return { ok: true, message: "Default probability saved." };
}

export async function reorderPipelineStagesAction(_previous: PipelineStageActionState, form: FormData): Promise<PipelineStageActionState> {
  await requirePermission("workspace.manage");
  let rawStageIds: unknown;
  try {
    rawStageIds = JSON.parse(formString(form, "stageIds"));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { message: "The stage order is invalid. Refresh and try again." };
  }
  const parsed = reorderPipelineStagesSchema.safeParse({ pipelineId: formString(form, "pipelineId"), stageIds: rawStageIds });
  if (!parsed.success) return { message: "The stage order is invalid. Refresh and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { error } = await supabase.rpc("reorder_pipeline_stages", { target_pipeline_id: parsed.data.pipelineId, target_stage_ids: parsed.data.stageIds });
  if (error) return { message: mutationMessage(error.code, "reorder") };
  revalidatePipelineSettings();
  return { ok: true, message: "Stage order saved." };
}
