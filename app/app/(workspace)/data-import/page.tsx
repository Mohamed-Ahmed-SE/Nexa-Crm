import { requirePermission } from "@/lib/auth/authorize";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { parseImportHistory, type ImportJobHistory } from "@/lib/csv/import-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ImportWorkspace } from "./import-workspace";

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("data.import");
  if (!hasWorkspacePermission(context.role, "crm.create")) notFound();
  const [query, jobs] = await Promise.all([searchParams, loadImportHistory(context.workspaceId)]);
  const requestedEntity = query.entity;
  const entity = requestedEntity === "leads" || requestedEntity === "contacts" || requestedEntity === "companies" ? requestedEntity : "leads";
  return <ImportWorkspace initialEntity={entity} historyJobs={jobs ?? []} historyError={jobs === null} />;
}

async function loadImportHistory(workspaceId: string): Promise<ImportJobHistory[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data: jobs, error: queryError } = await supabase.from("crm_import_jobs")
      .select("id, created_at, entity, status, total_rows, imported_rows, rejected_rows")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (queryError) return null;
    return parseImportHistory(jobs);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}
