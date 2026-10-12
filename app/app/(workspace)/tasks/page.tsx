import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { countWorkspaceTaskOverview, listTaskOptions, listWorkspaceTasks } from "@/lib/tasks/repository";
import { parseTaskSearchParams, restrictAllTasksView } from "@/lib/tasks/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TasksWorkspace } from "./tasks-workspace";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const parsedParams = parseTaskSearchParams(await searchParams);
  const params = canReassign ? parsedParams : restrictAllTasksView(parsedParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const [data, options, overview] = await Promise.all([
    listWorkspaceTasks(supabase, { workspaceId: context.workspaceId, userId: context.userId, params, canReassign }),
    canCreate ? listTaskOptions(supabase, context.workspaceId, context.userId, canReassign) : Promise.resolve([]),
    countWorkspaceTaskOverview(supabase, context.workspaceId, params),
  ]);
  return <TasksWorkspace tasks={data.tasks} owners={data.owners} options={options} matchedCount={data.matchedCount} overview={overview} params={params}
    canCreate={canCreate} canEdit={hasWorkspacePermission(context.role, "crm.edit.own")} canReassign={canReassign} canExport={hasWorkspacePermission(context.role, "data.export")} currentUserId={context.userId} />;
}
