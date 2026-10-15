"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { companySavedViewIdSchema, companySavedViewSchema } from "@/lib/companies/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CompanySavedViewActionState = { ok?: boolean; message?: string };

function formText(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function parseCompanySavedViewForm(formData: FormData) {
  return companySavedViewSchema.safeParse({
    name: formText(formData, "name"),
    filters: { q: formText(formData, "q"), ownerId: formText(formData, "ownerId") },
    sort: formText(formData, "sort"),
    visibleColumns: formData.getAll("visibleColumns").filter((column): column is string => typeof column === "string"),
  });
}

export async function saveCompanyViewAction(_previous: CompanySavedViewActionState, formData: FormData): Promise<CompanySavedViewActionState> {
  const context = await requirePermission("crm.view");
  const parsed = parseCompanySavedViewForm(formData);
  if (!parsed.success) return { message: "Enter a name and choose at least one valid column." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").insert({
    workspace_id: context.workspaceId, user_id: context.userId, entity_type: "companies",
    name: parsed.data.name, filters: parsed.data.filters, sort: parsed.data.sort,
    visible_columns: parsed.data.visibleColumns,
  });
  if (error) return { message: "Saved view could not be created. Try a different name." };
  revalidatePath("/app/companies");
  return { ok: true, message: "View saved." };
}

export async function deleteCompanyViewAction(_previous: CompanySavedViewActionState, formData: FormData): Promise<CompanySavedViewActionState> {
  const context = await requirePermission("crm.view");
  const id = companySavedViewIdSchema.safeParse(formText(formData, "id"));
  if (!id.success) return { message: "This saved view could not be identified." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").delete()
    .eq("workspace_id", context.workspaceId).eq("user_id", context.userId)
    .eq("entity_type", "companies").eq("id", id.data);
  if (error) return { message: "Saved view could not be deleted." };
  revalidatePath("/app/companies");
  return { ok: true, message: "View deleted." };
}
