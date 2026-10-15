import { describe, expect, it } from "vitest";
import { getDealAttentionReasons, listDealAttentionReasons } from "./attention";

const now = new Date("2026-04-15T12:00:00.000Z");
const deal = {
  id: "deal-1",
  status: "open" as const,
  expectedCloseDate: "2026-04-20",
  createdAt: "2026-03-01T12:00:00.000Z",
};

function reasons(options: {
  status?: "open" | "won" | "lost";
  expectedCloseDate?: string | null;
  createdAt?: string;
  tasks?: Array<{ relatedId: string | null; dueAt: string | null; status: string }>;
  latestActivityAt?: string | null;
} = {}) {
  return getDealAttentionReasons({
    deal: { ...deal, ...options, status: options.status ?? deal.status, expectedCloseDate: options.expectedCloseDate === undefined ? deal.expectedCloseDate : options.expectedCloseDate, createdAt: options.createdAt ?? deal.createdAt },
    tasks: options.tasks ?? [],
    latestActivityAt: options.latestActivityAt ?? null,
    today: "2026-04-15",
    now,
  });
}

function createAttentionQueryRecorder() {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gt", "gte", "lte", "order"]) {
    query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve: (response: { data: unknown[]; error: null }) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject);
  const supabase = { from: (table: string) => { calls.push(["from", table]); return query; } };
  return { supabase, calls };
}

describe("deal attention rules", () => {
  it.each([
    ["2026-04-14", true],
    ["2026-04-15", false],
    ["2026-04-16", false],
    [null, false],
  ])("flags only an expected close date before today (%s)", (expectedCloseDate, isOverdue) => {
    expect(reasons({ expectedCloseDate }).includes("overdue-close")).toBe(isOverdue);
  });

  it.each([
    ["future", [{ relatedId: "deal-1", dueAt: "2026-04-15T12:00:00.001Z", status: "open" }], false],
    ["overdue", [{ relatedId: "deal-1", dueAt: "2026-04-15T11:59:59.999Z", status: "open" }], true],
    ["due now", [{ relatedId: "deal-1", dueAt: "2026-04-15T12:00:00.000Z", status: "open" }], true],
    ["undated", [{ relatedId: "deal-1", dueAt: null, status: "open" }], true],
    ["completed future", [{ relatedId: "deal-1", dueAt: "2026-04-16T12:00:00.000Z", status: "completed" }], true],
  ])("requires an open task due strictly in the future (%s)", (_scenario, tasks, needsTask) => {
    expect(reasons({ tasks }).includes("no-future-task")).toBe(needsTask);
  });

  it("delays stale attention until 14 days and follows the latest activity", () => {
    expect(reasons({ createdAt: "2026-04-02T12:00:00.000Z" })).not.toContain("stale-activity");
    expect(reasons({ createdAt: "2026-04-01T12:00:00.000Z" })).toContain("stale-activity");
    expect(reasons({ latestActivityAt: "2026-04-14T12:00:00.000Z" })).not.toContain("stale-activity");
    expect(reasons({ latestActivityAt: "2026-04-01T12:00:00.000Z" })).toContain("stale-activity");
  });

  it.each(["won", "lost"] as const)("does not flag a terminal %s deal", (status) => {
    expect(reasons({ status, expectedCloseDate: "2026-04-14", createdAt: "2026-03-01T12:00:00.000Z" })).toEqual([]);
  });

  it("bounds attention reads to future tasks and activity from the inclusive stale cutoff", async () => {
    const { supabase, calls } = createAttentionQueryRecorder();

    await listDealAttentionReasons({
      supabase: supabase as never,
      workspaceId: "workspace-1",
      deals: [deal],
      today: "2026-04-15",
      now,
    });

    expect(calls).toContainEqual(["gt", "due_at", now.toISOString()]);
    expect(calls).toContainEqual(["gte", "occurred_at", "2026-04-01T12:00:00.000Z"]);
    expect(calls).toContainEqual(["lte", "occurred_at", now.toISOString()]);
    expect(calls.filter(([method, column, value]) => method === "eq" && column === "workspace_id" && value === "workspace-1")).toHaveLength(2);
    expect(calls.filter(([method, column, value]) => method === "eq" && column === "related_entity_type" && value === "deal")).toHaveLength(2);
    expect(calls.filter(([method, column, value]) => method === "in" && column === "related_entity_id" && Array.isArray(value) && value.includes("deal-1"))).toHaveLength(2);
  });

  it("returns each applicable reason for an open deal", () => {
    expect(reasons({ expectedCloseDate: "2026-04-14" })).toEqual(["overdue-close", "stale-activity", "no-future-task"]);
  });
});
