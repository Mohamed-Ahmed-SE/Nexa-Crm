import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { completeTaskAction, createTaskAction, rescheduleTaskAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const otherUserId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";
const taskId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const companyId = "8d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";

function createTaskForm(assignedTo = userId) {
  const form = new FormData();
  form.set("title", "Prepare renewal proposal");
  form.set("description", "Review the account before the call.");
  form.set("type", "follow_up");
  form.set("priority", "high");
  form.set("dueAt", "2025-03-04T09:30");
  form.set("timezoneOffset", "120");
  form.set("assignedTo", assignedTo);
  form.set("relatedType", "company");
  form.set("relatedId", companyId);
  return form;
}

function createTaskDatabase(companyOwnerId: string, activeMemberIds = [userId]) {
  const insertedTasks: Record<string, unknown>[] = [];
  const database = {
    rpc: async () => ({ data: activeMemberIds.map((activeUserId) => ({ user_id: activeUserId, role: "member", status: "active" })), error: null }),
    from: (table: string) => {
      const filters = new Map<string, unknown>();
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        },
        is: (column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        },
        maybeSingle: async () => table === "companies" &&
          filters.get("workspace_id") === workspaceId &&
          filters.get("id") === companyId &&
          filters.get("archived_at") === null
          ? { data: { id: companyId, owner_id: companyOwnerId, status: "active" }, error: null }
          : { data: null, error: null },
        insert: async (row: Record<string, unknown>) => {
          if (table === "tasks") insertedTasks.push(row);
          return { error: null };
        },
      };
      return query;
    },
  };
  return { database, insertedTasks };
}

type Task = {
  id: string;
  title: string;
  status: string;
  assigned_to: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  completed_at: string | null;
  due_at?: string | null;
};

function taskDatabase(task: Task, companyOwnerId: string | null, taskWorkspaceId = workspaceId) {
  const activities: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const from = (table: string) => {
    let operation: "select" | "update" = "select";
    let update: Partial<Task> = {};
    const filters = new Map<string, unknown>();
    const query = {
      select: () => query,
      update: (changes: Partial<Task>) => {
        operation = "update";
        update = changes;
        updates.push(changes);
        return query;
      },
      eq: (column: string, value: unknown) => {
        filters.set(column, value);
        return query;
      },
      is: () => query,
      maybeSingle: async () => {
        if (table === "tasks" && operation === "update") {
          if (
            task.status !== "open" ||
            filters.get("workspace_id") !== taskWorkspaceId ||
            filters.get("id") !== task.id ||
            filters.get("status") !== "open"
          ) return { data: null, error: null };
          Object.assign(task, update);
          return { data: { id: task.id }, error: null };
        }
        if (table === "tasks") {
          if (filters.get("workspace_id") !== taskWorkspaceId || filters.get("id") !== task.id) return { data: null, error: null };
          return { data: task, error: null };
        }
        if (table === "companies" && companyOwnerId && filters.get("owner_id") === companyOwnerId) return { data: { id: companyId, owner_id: companyOwnerId }, error: null };
        return { data: null, error: null };
      },
      insert: async (activity: Record<string, unknown>) => {
        activities.push(activity);
        return { error: null };
      },
    };
    return query;
  };

  return { database: { from }, task, activities, updates };
}

describe("complete task action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  });

  it("completes an assigned open task and records its related activity", async () => {
    const state = taskDatabase({
      id: taskId,
      title: "Call about renewal",
      status: "open",
      assigned_to: userId,
      related_entity_type: "company",
      related_entity_id: companyId,
      completed_at: null,
    }, userId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await completeTaskAction(taskId);

    expect(result).toEqual({ ok: true, message: "Task completed." });
    expect(state.task.status).toBe("completed");
    expect(state.task.completed_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(state.task.completed_at!))).toBe(false);
    expect(state.activities).toHaveLength(1);
    expect(state.activities[0]).toEqual(expect.objectContaining({
      workspace_id: workspaceId,
      activity_type: "task_completed",
      related_entity_type: "company",
      related_entity_id: companyId,
      metadata: { task_id: taskId },
    }));
    expect(state.activities[0].occurred_at).toBe(state.task.completed_at);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/app/tasks",
      `/app/companies/${companyId}`,
    ]);
  });

  it("denies an unassigned task linked to a record the member does not own", async () => {
    const state = taskDatabase({
      id: taskId,
      title: "Call about renewal",
      status: "open",
      assigned_to: otherUserId,
      related_entity_type: "company",
      related_entity_id: companyId,
      completed_at: null,
    }, otherUserId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await completeTaskAction(taskId);

    expect(result).toEqual({ message: "You can complete only tasks assigned to you or linked to a record you own." });
    expect(state.task.status).toBe("open");
    expect(state.task.completed_at).toBeNull();
    expect(state.activities).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed task ID before authorization or database access", async () => {
    const result = await completeTaskAction("not-a-uuid");

    expect(result).toEqual({ message: "This task could not be identified." });
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("reschedule task action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  });

  it("persists only the normalized due time for an authorized open task", async () => {
    const state = taskDatabase({
      id: taskId,
      title: "Call about renewal",
      status: "open",
      assigned_to: otherUserId,
      related_entity_type: "company",
      related_entity_id: companyId,
      completed_at: null,
      due_at: null,
    }, userId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);
    const form = new FormData();
    form.set("dueAt", "2026-04-03T10:30");
    form.set("timezoneOffset", "420");
    form.set("timeZone", "America/Phoenix");

    const result = await rescheduleTaskAction(taskId, form);

    expect(result).toEqual({ ok: true, message: "Task rescheduled." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
    expect(state.updates).toEqual([{ due_at: "2026-04-03T17:30:00.000Z" }]);
    expect(state.task).toMatchObject({ due_at: "2026-04-03T17:30:00.000Z", status: "open", assigned_to: otherUserId });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/app/tasks", `/app/companies/${companyId}`]);
  });

  it.each([
    { scenario: "closed", taskIdValue: taskId, status: "completed", workspace: workspaceId },
    { scenario: "not found", taskIdValue: otherUserId, status: "open", workspace: workspaceId },
    { scenario: "outside the workspace", taskIdValue: taskId, status: "open", workspace: otherUserId },
  ])("does not change a $scenario task", async ({ taskIdValue, status, workspace }) => {
    const state = taskDatabase({
      id: taskIdValue,
      title: "Call about renewal",
      status,
      assigned_to: userId,
      related_entity_type: null,
      related_entity_id: null,
      completed_at: null,
    }, null, workspace);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);
    const form = new FormData();
    form.set("dueAt", "2026-04-03T10:30");
    form.set("timezoneOffset", "420");
    form.set("timeZone", "America/Phoenix");

    const result = await rescheduleTaskAction(taskId, form);

    expect(result).toEqual({ message: "This open task could not be found in your workspace." });
    expect(state.updates).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies an open task assigned to another user without a linked record they own", async () => {
    const state = taskDatabase({
      id: taskId,
      title: "Call about renewal",
      status: "open",
      assigned_to: otherUserId,
      related_entity_type: "company",
      related_entity_id: companyId,
      completed_at: null,
    }, otherUserId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);
    const form = new FormData();
    form.set("dueAt", "2026-04-03T10:30");
    form.set("timezoneOffset", "420");
    form.set("timeZone", "America/Phoenix");

    const result = await rescheduleTaskAction(taskId, form);

    expect(result).toEqual({ message: "You can reschedule only tasks assigned to you or linked to a record you own." });
    expect(state.updates).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a local time skipped by the daylight-saving transition", async () => {
    const form = new FormData();
    form.set("dueAt", "2026-03-08T02:30");
    form.set("timezoneOffset", "300");
    form.set("timeZone", "America/New_York");

    const result = await rescheduleTaskAction(taskId, form);

    expect(result).toMatchObject({ message: "Enter a valid due date and time.", fieldErrors: { dueAt: ["This local time does not exist in your timezone. Choose another time."] } });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid due date before database access", async () => {
    const form = new FormData();
    form.set("dueAt", "2026-02-31T10:30");
    form.set("timezoneOffset", "420");
    form.set("timeZone", "America/Phoenix");

    const result = await rescheduleTaskAction(taskId, form);

    expect(result).toMatchObject({ message: "Enter a valid due date and time.", fieldErrors: { dueAt: ["Enter a valid due date and time."] } });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("create task action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  });

  it("creates a task assigned to the member and linked to their company", async () => {
    const state = createTaskDatabase(userId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await createTaskAction({}, createTaskForm());

    expect(result).toEqual({ ok: true, message: "Task created." });
    expect(state.insertedTasks).toEqual([expect.objectContaining({
      workspace_id: workspaceId,
      created_by: userId,
      assigned_to: userId,
      title: "Prepare renewal proposal",
      task_type: "follow_up",
      priority: "high",
      status: "open",
      related_entity_type: "company",
      related_entity_id: companyId,
      due_at: "2025-03-04T11:30:00.000Z",
    })]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/tasks");
  });

  it("denies a member assigning a task to another user", async () => {
    const state = createTaskDatabase(userId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await createTaskAction({}, createTaskForm(otherUserId));

    expect(result).toEqual({ message: "You can assign tasks only to yourself." });
    expect(state.insertedTasks).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies a manager assigning a task to someone who is not an active workspace member", async () => {
    const state = createTaskDatabase(userId, []);
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await createTaskAction({}, createTaskForm(otherUserId));

    expect(result).toEqual({ message: "Choose an active member of this workspace." });
    expect(state.insertedTasks).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies a task linked to a company owned by another user", async () => {
    const state = createTaskDatabase(otherUserId);
    mocks.createSupabaseServerClient.mockResolvedValue(state.database);

    const result = await createTaskAction({}, createTaskForm());

    expect(result).toEqual({ message: "Choose an active related record in this workspace that you can access." });
    expect(state.insertedTasks).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
