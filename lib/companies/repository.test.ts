import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCompanyDetail, listCompanySavedViews } from "@/lib/companies/repository";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

function savedViewsClient() {
  const response = {
    data: [
      { id: "owned-view", name: "Accounts", filters: { q: "Acme", ownerId: "" }, sort: "name_asc", visible_columns: ["company", "owner"] },
      { id: "bad-view", name: "Broken", filters: { q: "Acme", ownerId: "", extra: true }, sort: "name_asc", visible_columns: ["company"] },
    ],
    error: null,
  };
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    then: (resolve: (result: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { from, query, supabase: { from } };
}

describe("company saved-view repository", () => {
  it("scopes views to the authenticated workspace user and Companies entity, ignoring invalid stored data", async () => {
    const { from, query, supabase } = savedViewsClient();

    const views = await listCompanySavedViews(supabase as never, workspaceId, userId);

    expect(from).toHaveBeenCalledWith("saved_views");
    expect(query.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId], ["user_id", userId], ["entity_type", "companies"],
    ]);
    expect(views).toEqual([{
      id: "owned-view", name: "Accounts", filters: { q: "Acme", ownerId: "" }, sort: "name_asc", visibleColumns: ["company", "owner"],
    }]);
  });
});

function timelineClient(parent: Record<string, unknown>, activities: unknown[]) {
  const activityCalls: Array<[string, unknown[]]> = [];
  const fromQuery = (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "limit", "range"]) {
      query[method] = (...args: unknown[]) => {
        if (table === "activities") activityCalls.push([method, args]);
        return query;
      };
    }
    query.maybeSingle = () => Promise.resolve({ data: parent, error: null });
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === "activities" ? activities : [], error: null, count: table === "activities" ? activities.length : null }).then(resolve, reject);
    return query;
  };
  return { supabase: { from: vi.fn(fromQuery), rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) }, activityCalls };
}

describe("company detail activity timeline", () => {
  it("loads the creator and system flag needed to authorize activity edits, scoped to this company", async () => {
    const activities = [{ id: "activity-1", activity_type: "meeting", subject: "Review", body: null, occurred_at: "2026-04-03T12:00:00Z", created_by: userId, is_system_event: false }];
    const { supabase, activityCalls } = timelineClient({ id: "company-1", workspace_id: workspaceId, owner_id: null }, activities);

    const detail = await getCompanyDetail(supabase as never, workspaceId, "company-1");

    const selected = String(activityCalls.find(([method]) => method === "select")?.[1][0]);
    expect(selected.split(",").map((column) => column.trim())).toEqual(expect.arrayContaining(["id", "created_by", "is_system_event"]));
    expect(activityCalls.filter(([method]) => method === "eq").map(([, args]) => args)).toEqual([["workspace_id", workspaceId], ["related_entity_type", "company"], ["related_entity_id", "company-1"]]);
    expect(detail?.activities).toEqual(activities);
  });
});
