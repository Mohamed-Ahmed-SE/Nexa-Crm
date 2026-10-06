"use server";

import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { parseImportRowErrors, type ImportRowError } from "@/lib/csv/import-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ImportErrorsResult = { ok: true; errors: ImportRowError[] } | { ok: false; message: string };

export async function getImportJobErrors(jobId: string): Promise<ImportErrorsResult> {
  const context = await requirePermission("data.import");
  if (!hasWorkspacePermission(context.role, "crm.create")) return { ok: false, message: "You are not authorized to view import reports." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return { ok: false, message: "This import report could not be loaded." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Import history is unavailable right now." };
  try {
    const { data: job, error: queryError } = await supabase.from("crm_import_jobs")
      .select("row_errors, rejected_rows")
      .eq("workspace_id", context.workspaceId)
      .eq("id", jobId)
      .maybeSingle();
    if (queryError || !job) return { ok: false, message: "This import report could not be loaded." };
    const errors = parseImportRowErrors(job.row_errors, job.rejected_rows);
    return errors ? { ok: true, errors } : { ok: false, message: "The saved import report is invalid." };
  } catch (error) {
    if (error instanceof TypeError) return { ok: false, message: "Import history is unavailable right now." };
    throw error;
  }
}
