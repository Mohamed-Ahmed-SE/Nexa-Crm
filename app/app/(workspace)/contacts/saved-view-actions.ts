"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { contactSavedViewIdSchema, contactSavedViewSchema } from "@/lib/contacts/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContactSavedViewActionState = { ok?: boolean; message?: string };

function formText(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function parseContactSavedViewForm(formData: FormData) {
  return contactSavedViewSchema.safeParse({
    name: formText(formData, "name"),
    filters: {
      q: formText(formData, "q"), lifecycle: formText(formData, "lifecycle"),
      companyId: formText(formData, "companyId"), ownerId: formText(formData, "ownerId"),
    },
    sort: formText(formData, "sort"),
    visibleColumns: formData.getAll("visibleColumns").filter((column): column is string => typeof column === "string"),
  });
}

export async function saveContactViewAction(_previous: ContactSavedViewActionState, formData: FormData): Promise<ContactSavedViewActionState> {
  const context = await requirePermission("crm.view");
  const parsed = parseContactSavedViewForm(formData);
  if (!parsed.success) return { message: "Enter a name and choose at least one valid column." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").insert({
    workspace_id: context.workspaceId, user_id: context.userId, entity_type: "contacts",
    name: parsed.data.name, filters: parsed.data.filters, sort: parsed.data.sort,
    visible_columns: parsed.data.visibleColumns,
  });
  if (error) return { message: "Saved view could not be created. Try a different name." };
  revalidatePath("/app/contacts");
  return { ok: true, message: "View saved." };
}

export async function deleteContactViewAction(_previous: ContactSavedViewActionState, formData: FormData): Promise<ContactSavedViewActionState> {
  const context = await requirePermission("crm.view");
  const id = contactSavedViewIdSchema.safeParse(formText(formData, "id"));
  if (!id.success) return { message: "This saved view could not be identified." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("saved_views").delete()
    .eq("workspace_id", context.workspaceId).eq("user_id", context.userId)
    .eq("entity_type", "contacts").eq("id", id.data);
  if (error) return { message: "Saved view could not be deleted." };
  revalidatePath("/app/contacts");
  return { ok: true, message: "View deleted." };
}
