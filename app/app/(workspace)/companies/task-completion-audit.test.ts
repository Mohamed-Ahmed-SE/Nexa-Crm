import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { completeCompanyTaskAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const companyId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const ownerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const taskId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";
const completedAt = "2026-04-03T10:15:00.000Z";

function completionForm() {
  const form = new FormData();
  form.set("taskId", taskId);
  form.set("companyId", companyId);
  return form;
}

function setupCompletion({ updateError = null, completedTask = { id: taskId }, activityError = null }: {
  updateError?: Error | null;
  completedTask?: { id: string } | null;
  activityError?: Error | null;
} = {}) {
  const companyQuery = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: companyId, owner_id: ownerId }, error: null }),
  };
  const taskQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: taskId, title: "Prepare proposal", status: "open", assigned_to: userId, related_entity_type: "company", related_entity_id: companyId },
      error: null,
    }),
  };
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: completedTask, error: updateError }),
  };
  const taskTable = { select: vi.fn().mockReturnValue(taskQuery), update: vi.fn().mockReturnValue(updateQuery) };
  mocks.activityInsert.mockResolvedValue({ error: activityError });
  mocks.from.mockImplementation((table: string) => {
    if (table === "companies") return { select: vi.fn().mockReturnValue(companyQuery) };
    if (table === "tasks") return taskTable;
    return { insert: mocks.activityInsert };
  });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("company task completion activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCompletion();
  });

  afterEach(() => vi.useRealTimers());

  it("records the completed task on its company timeline using the completion timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(completedAt));

    const response = await completeCompanyTaskAction({}, completionForm());

    expect(response).toEqual({ ok: true });
    expect(mocks.activityInsert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      activity_type: "task_completed",
      subject: "Task completed",
      body: "Prepare proposal",
      occurred_at: completedAt,
      created_by: userId,
      owner_id: userId,
      related_entity_type: "company",
      related_entity_id: companyId,
      metadata: { task_id: taskId },
      is_system_event: false,
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      `/app/companies/${companyId}`,
      "/app/tasks",
    ]);
  });

  it.each([
    ["an update error", new Error("update failed"), { id: taskId }],
    ["a racing no-row update", null, null],
  ])("does not log or refresh after %s", async (_scenario, updateError, completedTask) => {
    setupCompletion({ updateError, completedTask });

    const response = await completeCompanyTaskAction({}, completionForm());

    expect(response).toEqual({ message: "Unable to complete this task." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps completion successful and warns when Supabase returns an activity error", async () => {
    setupCompletion({ activityError: new Error("activity insert failed") });

    const response = await completeCompanyTaskAction({}, completionForm());

    expect(response).toEqual({
      ok: true,
      message: "Task completed, but its activity could not be recorded.",
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      `/app/companies/${companyId}`,
      "/app/tasks",
    ]);
  });

  it("propagates an unexpected activity exception after refreshing the completed task", async () => {
    mocks.activityInsert.mockRejectedValueOnce(new Error("unexpected activity failure"));

    await expect(completeCompanyTaskAction({}, completionForm())).rejects.toThrow("unexpected activity failure");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      `/app/companies/${companyId}`,
      "/app/tasks",
    ]);
  });
});
