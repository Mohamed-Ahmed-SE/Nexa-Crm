import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { listTaskOptions, listWorkspaceTasks } from "@/lib/tasks/repository";
import { parseTaskSearchParams } from "@/lib/tasks/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TasksWorkspace } from "./tasks-workspace";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const params = parseTaskSearchParams(await searchParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const [data, options] = await Promise.all([
    listWorkspaceTasks(supabase, context.workspaceId, context.userId, params),
    canCreate ? listTaskOptions(supabase, context.workspaceId, context.userId, canReassign) : Promise.resolve([]),
  ]);
  return <TasksWorkspace tasks={data.tasks} owners={data.owners} options={options} matchedCount={data.matchedCount} params={params}
    canCreate={canCreate} canEdit={hasWorkspacePermission(context.role, "crm.edit.own")} canReassign={canReassign} canExport={hasWorkspacePermission(context.role, "data.export")} currentUserId={context.userId} />;
}
