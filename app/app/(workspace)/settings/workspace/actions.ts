"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { workspaceSettingsSchema } from "@/lib/workspaces/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceSettingsActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };

function formString(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function revalidateWorkspaceSettings() {
  for (const path of ["/app", "/app/settings", "/app/settings/workspace", "/app/dashboard", "/app/deals", "/app/leads", "/app/reports"]) {
    revalidatePath(path);
  }
}

export async function updateWorkspaceSettingsAction(_previous: WorkspaceSettingsActionState, form: FormData): Promise<WorkspaceSettingsActionState> {
  const context = await requirePermission("workspace.manage");
  const parsed = workspaceSettingsSchema.safeParse({
    name: formString(form, "name"),
    logoUrl: formString(form, "logoUrl"),
    defaultCurrency: formString(form, "defaultCurrency"),
    timezone: formString(form, "timezone"),
  });
  if (!parsed.success) return { message: "Check the workspace settings and try again.", fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: workspace, error } = await supabase.from("workspaces").update({
    name: parsed.data.name,
    logo_url: parsed.data.logoUrl,
    default_currency: parsed.data.defaultCurrency,
    timezone: parsed.data.timezone,
  }).eq("id", context.workspaceId).select("id").maybeSingle();
  if (error || !workspace) return { message: "Unable to save workspace settings. Try again." };

  revalidateWorkspaceSettings();
  return { ok: true, message: "Workspace settings saved." };
}
