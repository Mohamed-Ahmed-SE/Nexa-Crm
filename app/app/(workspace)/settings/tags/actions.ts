"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { createTagSchema, renameTagSchema, tagIdSchema } from "@/lib/tags/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TagActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };

function formString(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function revalidateSettings() {
  revalidatePath("/app/settings");
  revalidatePath("/app/settings/tags");
}

function mutationMessage(errorCode: string | undefined, action: "create" | "rename") {
  if (errorCode === "23505") return "A tag with that name already exists in this workspace.";
  return action === "create" ? "Unable to create this tag. Try again." : "Unable to rename this tag. Try again.";
}

export async function createTagAction(_previous: TagActionState, form: FormData): Promise<TagActionState> {
  const context = await requirePermission("workspace.manage");
  const parsed = createTagSchema.safeParse({ name: formString(form, "name") });
  if (!parsed.success) return { message: "Check the tag name and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { error } = await supabase.from("tags").insert({ workspace_id: context.workspaceId, name: parsed.data.name });
  if (error) return { message: mutationMessage(error.code, "create") };
  revalidateSettings();
  return { ok: true, message: "Tag created." };
}

export async function renameTagAction(_previous: TagActionState, form: FormData): Promise<TagActionState> {
  const context = await requirePermission("workspace.manage");
  const parsed = renameTagSchema.safeParse({ id: formString(form, "tagId"), name: formString(form, "name") });
  if (!parsed.success) return { message: "Check the tag name and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { data: tag, error } = await supabase.from("tags").update({ name: parsed.data.name }).eq("workspace_id", context.workspaceId).eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) return { message: mutationMessage(error.code, "rename") };
  if (!tag) return { message: "This tag could not be found in your workspace." };
  revalidateSettings();
  return { ok: true, message: "Tag renamed." };
}

export async function deleteTagAction(tagId: string): Promise<TagActionState> {
  const context = await requirePermission("workspace.manage");
  const parsed = tagIdSchema.safeParse(tagId);
  if (!parsed.success) return { message: "This tag could not be identified." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { data: tag, error } = await supabase.from("tags").delete().eq("workspace_id", context.workspaceId).eq("id", parsed.data).select("id").maybeSingle();
  if (error) return { message: "Unable to remove this tag. Try again." };
  if (!tag) return { message: "This tag could not be found in your workspace." };
  revalidateSettings();
  return { ok: true, message: "Tag removed. Any assignments to this tag were removed too." };
}
