import { describe, expect, it } from "vitest";
import { formatTaskOwners } from "./owner-labels";
import { countTaskCompletionSummary, listTaskCalendarRecords, listWorkspaceTasks } from "./repository";
import { parseTaskSearchParams, taskDateBounds } from "./schema";

function createTaskQueryRecorder() {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "not", "or", "order", "range"]) {
    query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
  const supabase = {
    from: (table: string) => { calls.push(["from", table]); return query; },
    rpc: () => Promise.resolve({ data: [], error: null }),
  };
  return { supabase, calls };
}

describe("task assignee labels", () => {
  it("keeps the current user recognizable and distinguishes workspace members", () => {
    expect(formatTaskOwners([
      { user_id: "a1b2c3d4-current" },
      { user_id: "11223344-member" },
      { user_id: "aabbccdd-member" },
    ], "a1b2c3d4-current")).toEqual([
      { id: "a1b2c3d4-current", label: "You" },
      { id: "11223344-member", label: "Workspace member · 112233" },
      { id: "aabbccdd-member", label: "Workspace member · aabbcc" },
    ]);
  });
});

describe("workspace task date filtering", () => {
  it("applies workspace, owner, view, and DST-aware day filters before pagination", async () => {
    const { supabase, calls } = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "upcoming", date: "2026-03-08", calendarMonth: "2026-03", timeZone: "America/New_York", q: "proposal", type: "email", priority: "high", sort: "title", page: "3" });

    await listWorkspaceTasks(supabase as never, { workspaceId: "workspace-1", userId: "member-1", params, canReassign: false, now: new Date("2026-03-08T12:00:00.000Z") });

    expect(calls).toContainEqual(["eq", "workspace_id", "workspace-1"]);
    expect(calls).toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(calls).toContainEqual(["eq", "status", "open"]);
    expect(calls).toContainEqual(["gte", "due_at", "2026-03-08T05:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "due_at", "2026-03-09T04:00:00.000Z"]);
    expect(calls).toContainEqual(["eq", "priority", "high"]);
    expect(calls).toContainEqual(["eq", "task_type", "email"]);
    expect(calls).toContainEqual(["or", 'title.ilike."%proposal%",description.ilike."%proposal%"']);
    expect(calls.at(-1)).toEqual(["range", 50, 74]);
  });

  it("keeps calendar and persisted status counts inside the member-visible scope", async () => {
    const { supabase, calls } = createTaskQueryRecorder();
    const calendarDates = await listTaskCalendarRecords(supabase as never, { workspaceId: "workspace-1", userId: "member-1", canReassign: false, params: parseTaskSearchParams({ timeZone: "America/New_York" }), calendarMonth: "2026-03" });
    const completionCounts = await countTaskCompletionSummary(supabase as never, "workspace-1", "member-1", false);

    expect(calendarDates).toEqual([]);
    expect(completionCounts).toEqual({ open: 0, completed: 0, cancelled: 0 });
    expect(calls).toContainEqual(["gte", "due_at", "2026-03-01T05:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "due_at", "2026-04-01T04:00:00.000Z"]);
    expect(calls.filter(([method, column]) => method === "eq" && column === "assigned_to")).toHaveLength(5);
    expect(calls.filter(([method, column]) => method === "eq" && column === "workspace_id")).toHaveLength(4);
  });

  it("marks only the current user's matching My Tasks dates for reassign-capable users", async () => {
    const { supabase, calls } = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "my", date: "2026-03-08", calendarMonth: "2026-03", timeZone: "America/New_York", q: "proposal", type: "email", priority: "high", sort: "title", page: "4" });

    await listTaskCalendarRecords(supabase as never, { workspaceId: "workspace-1", userId: "member-1", canReassign: true, params, calendarMonth: "2026-03", now: new Date("2026-03-08T12:00:00.000Z") });

    expect(calls).toContainEqual(["eq", "workspace_id", "workspace-1"]);
    expect(calls).toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(calls).toContainEqual(["eq", "status", "open"]);
    expect(calls).toContainEqual(["eq", "priority", "high"]);
    expect(calls).toContainEqual(["eq", "task_type", "email"]);
    expect(calls).toContainEqual(["or", 'title.ilike."%proposal%",description.ilike."%proposal%"']);
    expect(calls).toContainEqual(["gte", "due_at", "2026-03-01T05:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "due_at", "2026-04-01T04:00:00.000Z"]);
    expect(calls.filter(([method]) => method === "order" || method === "range")).toEqual([]);
    expect(calls).not.toContainEqual(["gte", "due_at", "2026-03-08T05:00:00.000Z"]);
  });

  it("shows cancelled tasks only to their assignees unless workspace reassignment is permitted", async () => {
    const memberQuery = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "cancelled" });

    await listWorkspaceTasks(memberQuery.supabase as never, { workspaceId: "workspace-1", userId: "member-1", params, canReassign: false });
    expect(memberQuery.calls).toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(memberQuery.calls).toContainEqual(["eq", "status", "cancelled"]);

    const managerQuery = createTaskQueryRecorder();
    await listWorkspaceTasks(managerQuery.supabase as never, { workspaceId: "workspace-1", userId: "manager-1", params, canReassign: true });
    expect(managerQuery.calls).not.toContainEqual(["eq", "assigned_to", "manager-1"]);
    expect(managerQuery.calls).toContainEqual(["eq", "status", "cancelled"]);
  });

  it("filters cancelled tasks in the calendar within the same assignee scope", async () => {
    const { supabase, calls } = createTaskQueryRecorder();
    await listTaskCalendarRecords(supabase as never, { workspaceId: "workspace-1", userId: "member-1", canReassign: false, params: parseTaskSearchParams({ view: "cancelled" }), calendarMonth: "2026-03" });

    expect(calls).toContainEqual(["eq", "workspace_id", "workspace-1"]);
    expect(calls).toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(calls).toContainEqual(["eq", "status", "cancelled"]);
  });

  it("does not limit the permitted all-workspace view to the current assignee", async () => {
    const { supabase, calls } = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "all", date: "2026-03-08", timeZone: "America/New_York" });

    await listWorkspaceTasks(supabase as never, { workspaceId: "workspace-1", userId: "member-1", params, canReassign: true });

    expect(calls).toContainEqual(["eq", "workspace_id", "workspace-1"]);
    expect(calls).not.toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(calls).toContainEqual(["eq", "status", "open"]);
  });

  it("filters the tomorrow view to the user-local tomorrow window using the tomorrow timezone offset", async () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    const { supabase, calls } = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "tomorrow", timezoneOffset: "300", tomorrowTimezoneOffset: "240" });
    const { tomorrow, dayAfterTomorrow } = taskDateBounds(now, 300, 240);

    await listWorkspaceTasks(supabase as never, { workspaceId: "workspace-1", userId: "member-1", params, canReassign: false, now });

    expect(calls).toContainEqual(["eq", "status", "open"]);
    expect(calls).toContainEqual(["gte", "due_at", tomorrow.toISOString()]);
    expect(calls).toContainEqual(["lt", "due_at", dayAfterTomorrow.toISOString()]);
    const { start: today } = taskDateBounds(now, 300, 240);
    expect(calls).not.toContainEqual(["gte", "due_at", today.toISOString()]);
  });

  it("filters the tomorrow view in the calendar within the same window and assignee scope", async () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    const { supabase, calls } = createTaskQueryRecorder();
    const params = parseTaskSearchParams({ view: "tomorrow", timezoneOffset: "300", tomorrowTimezoneOffset: "240" });
    const { tomorrow, dayAfterTomorrow } = taskDateBounds(now, 300, 240);

    await listTaskCalendarRecords(supabase as never, { workspaceId: "workspace-1", userId: "member-1", canReassign: false, params, calendarMonth: "2026-03", now });

    expect(calls).toContainEqual(["eq", "workspace_id", "workspace-1"]);
    expect(calls).toContainEqual(["eq", "assigned_to", "member-1"]);
    expect(calls).toContainEqual(["eq", "status", "open"]);
    expect(calls).toContainEqual(["gte", "due_at", tomorrow.toISOString()]);
    expect(calls).toContainEqual(["lt", "due_at", dayAfterTomorrow.toISOString()]);
  });
});
