import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { countTaskCompletionSummary, countWorkspaceTaskOverview, listTaskCalendarRecords, listTaskOptions, listWorkspaceTasks } from "@/lib/tasks/repository";
import { parseTaskSearchParams, restrictAllTasksView } from "@/lib/tasks/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TasksWorkspace } from "./tasks-workspace";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const rawParams = await searchParams;
  const parsedParams = parseTaskSearchParams(rawParams);
  const params = canReassign ? parsedParams : restrictAllTasksView(parsedParams);
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: params.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const localDate = `${dateParts.find(({ type }) => type === "year")?.value}-${dateParts.find(({ type }) => type === "month")?.value}-${dateParts.find(({ type }) => type === "day")?.value}`;
  const railDate = params.date ?? localDate;
  const calendarMonth = params.calendarMonth ?? railDate.slice(0, 7);
  const railParams = { ...params, date: railDate, page: 1 };
  const [data, options, overview, rail, calendarRecords, completion] = await Promise.all([
    listWorkspaceTasks(supabase, { workspaceId: context.workspaceId, userId: context.userId, params, canReassign, now }),
    canCreate ? listTaskOptions(supabase, context.workspaceId, context.userId, canReassign) : Promise.resolve([]),
    countWorkspaceTaskOverview(supabase, context.workspaceId, params, now),
    listWorkspaceTasks(supabase, { workspaceId: context.workspaceId, userId: context.userId, params: railParams, canReassign, now }),
    listTaskCalendarRecords(supabase, { workspaceId: context.workspaceId, userId: context.userId, canReassign, params, calendarMonth, now }),
    countTaskCompletionSummary(supabase, context.workspaceId, context.userId, canReassign),
  ]);
  const requestedType = rawParams.relatedType;
  const requestedId = rawParams.relatedId;
  const requestedContext = typeof requestedType === "string" && typeof requestedId === "string"
    ? options.find((option) => option.type === requestedType && option.id === requestedId) ?? null
    : null;
  const hasRequestedContext = requestedType !== undefined || requestedId !== undefined;
  const createIntent = canCreate && rawParams.create === "1" && (!hasRequestedContext || requestedContext !== null);
  return <TasksWorkspace tasks={data.tasks} owners={data.owners} options={options} matchedCount={data.matchedCount} overview={overview} params={params}
    railTasks={rail.tasks} railTaskCount={rail.matchedCount} calendarMonth={calendarMonth} calendarTaskDates={calendarRecords} railDate={railDate} completion={completion}
    canCreate={canCreate} createIntent={createIntent} createContext={requestedContext ? { type: requestedContext.type, id: requestedContext.id } : null} canEdit={hasWorkspacePermission(context.role, "crm.edit.own")} canReassign={canReassign} canExport={hasWorkspacePermission(context.role, "data.export")} currentUserId={context.userId} />;
}
