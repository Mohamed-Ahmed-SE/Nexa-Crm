import { requirePermission } from "@/lib/auth/authorize";
import { parseReportFilters } from "@/lib/reports/schema";
import { loadWorkspaceReport } from "@/lib/reports/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReportsWorkspace } from "./reports-workspace";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("reports.view");
  const filters = parseReportFilters(await searchParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <ReportsUnavailable />;
  try {
    const result = await loadWorkspaceReport(supabase, context.workspaceId, filters);
    return <ReportsWorkspace {...result} />;
  } catch {
    return <ReportsUnavailable />;
  }
}

function ReportsUnavailable() {
  return <main className="page-container reports-page"><header className="reports-header"><div><h1 className="page-title">Reports</h1><p className="page-description">Understand sales performance from your workspace records.</p></div></header><section className="reports-error" role="alert"><h2>Reports could not be loaded</h2><p>Check your connection and reload this page. No report data has been changed.</p></section></main>;
}
