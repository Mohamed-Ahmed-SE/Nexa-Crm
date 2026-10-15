import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadWorkspaceReport } from "./repository";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const inactiveOwnerId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const activeOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const inactiveDealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const activeDealId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function query(data: unknown) {
  const result = { data, error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: async () => result,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const report = {
  currency: "USD",
  summary: { won_revenue: 0, total_deal_value: 0, total_deals: 2, won_count: 0, lost_count: 0, average_deal_value: 0 },
  revenue_trend: [], pipeline_by_stage: [], pipeline_by_owner: [], deals_by_source: [], lead_source_performance: [],
  tasks: { completed: 0, overdue: 0 }, deal_conversion_funnel: [], activity_by_rep: [],
  top_deals: [
    { id: inactiveDealId, title: "Inactive owner's deal", company: null, owner: "Alex Rivera", stage: null, amount: 100, created_at: "2026-04-01T00:00:00Z", status: "open" as const },
    { id: activeDealId, title: "Active owner's deal", company: null, owner: "Alex Rivera", stage: null, amount: 90, created_at: "2026-04-01T00:00:00Z", status: "open" as const },
  ],
  outcomes: { won: 0, lost: 0, open: 2 },
};

function createSupabase() {
  return {
    from: (table: string) => query(table === "workspaces"
      ? { default_currency: "USD" }
      : table === "deals"
        ? [{ id: inactiveDealId, owner_id: inactiveOwnerId }, { id: activeDealId, owner_id: activeOwnerId }]
        : []),
    rpc: async (name: string) => {
      if (name === "list_reassignable_workspace_members") return { data: [{ user_id: activeOwnerId }], error: null };
      if (name === "get_workspace_report_member_labels") return { data: [
        { user_id: inactiveOwnerId, display_name: "Alex Rivera" },
        { user_id: activeOwnerId, display_name: "Alex Rivera" },
      ], error: null };
      if (name === "list_inactive_workspace_member_ids") return { data: [{ user_id: inactiveOwnerId }], error: null };
      return { data: report, error: null };
    },
  };
}

describe("workspace report top-deal owners", () => {
  it("marks only the deal owned by the inactive ID when display names collide", async () => {
    const result = await loadWorkspaceReport(createSupabase() as never, workspaceId, {
      start: "2026-04-01", end: "2026-04-30", ownerId: "all", pipelineId: "all", invalid: false,
    });

    expect(result.report.top_deals.map(({ owner }) => owner)).toEqual([
      "Alex Rivera · Inactive user",
      "Alex Rivera",
    ]);
  });
});
