"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { leadSavedViewIdSchema, leadSavedViewSchema } from "@/lib/leads/saved-view-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SavedViewActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseSavedViewForm(formData: FormData) {
  return leadSavedViewSchema.safeParse({
    name: textValue(formData, "name"),
    filters: { q: textValue(formData, "q"), status: textValue(formData, "status"), sourceId: textValue(formData, "sourceId"), ownerId: textValue(formData, "ownerId"), tagId: textValue(formData, "tagId") },
    sort: textValue(formData, "sort"),
    visibleColumns: formData.getAll("visibleColumns").filter((column): column is string => typeof column === "string"),
  });
}

export async function saveLeadViewAction(_previous: SavedViewActionState, formData: FormData): Promise<SavedViewActionState> {
  const context = await requirePermission("crm.view");
  const parsed = parseSavedViewForm(formData);
  if (!parsed.success) return { message: "Enter a name and choose at least one valid column." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").insert({
    workspace_id: context.workspaceId, user_id: context.userId, entity_type: "leads",
    name: parsed.data.name,
    filters: parsed.data.filters,
    sort: parsed.data.sort,
    visible_columns: parsed.data.visibleColumns,
  });
  if (error) return { message: "Saved view could not be created. Try a different name." };
  revalidatePath("/app/leads");
  return { ok: true, message: "View saved." };
}

export async function deleteLeadViewAction(_previous: SavedViewActionState, formData: FormData): Promise<SavedViewActionState> {
  const context = await requirePermission("crm.view");
  const parsedId = leadSavedViewIdSchema.safeParse(textValue(formData, "id"));
  if (!parsedId.success) return { message: "This saved view could not be identified." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").delete()
    .eq("workspace_id", context.workspaceId).eq("user_id", context.userId)
    .eq("entity_type", "leads").eq("id", parsedId.data);
  if (error) return { message: "Saved view could not be deleted." };
  revalidatePath("/app/leads");
  return { ok: true, message: "View deleted." };
}
