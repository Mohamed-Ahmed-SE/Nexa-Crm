import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { parseDealSearchParams } from "@/lib/deals/schema";
import { listWorkspaceDeals } from "@/lib/deals/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DealsWorkspace } from "./deals-workspace";

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const rawParams = await searchParams;
  const params = parseDealSearchParams(rawParams);
  const view = rawParams.view === "list" ? "list" : "board";
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <DealsLoadError />;
  const data = await listWorkspaceDeals(supabase, context.workspaceId, context.userId, context.fullName, params);
  return <DealsWorkspace
    canCreate={canCreate}
    createIntent={canCreate && rawParams.create === "1"}
    canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")}
    canEditOwn={hasWorkspacePermission(context.role, "crm.edit.own")}
    canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
    currentUserId={context.userId}
    data={data}
    ownerFilter={params.ownerId}
    todayIso={new Date().toISOString().slice(0, 10)}
    search={params.q}
    view={view}
  />;
}

function DealsLoadError() {
  return <div className="page-container deals-page"><header className="deals-header"><div><h1 className="page-title">Deals</h1><p className="page-description">Track active work across your sales pipeline.</p></div></header><section className="deals-error" role="alert"><h2>Deals could not be loaded</h2><p>Check your connection and reload this page. Your workspace records have not been changed.</p></section></div>;
}
