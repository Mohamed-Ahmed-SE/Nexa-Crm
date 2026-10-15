import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getContactDetail, listContactSavedViews } from "@/lib/contacts/repository";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

function savedViewsClient() {
  const response = {
    data: [
      { id: "owned-view", name: "Customers", filters: { q: "", lifecycle: "customer", companyId: "", ownerId: "" }, sort: "name_asc", visible_columns: ["name"] },
      { id: "bad-view", name: "Broken", filters: { lifecycle: "customer", unexpected: true }, sort: "updated_desc", visible_columns: ["name"] },
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

describe("contact saved-view repository", () => {
  it("scopes reads to the caller's workspace, user, and Contacts entity and ignores malformed JSON", async () => {
    const { from, query, supabase } = savedViewsClient();

    const views = await listContactSavedViews(supabase as never, workspaceId, userId);

    expect(from).toHaveBeenCalledWith("saved_views");
    expect(query.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId], ["user_id", userId], ["entity_type", "contacts"],
    ]);
    expect(views).toEqual([{
      id: "owned-view", name: "Customers",
      filters: { q: "", lifecycle: "customer", companyId: "", ownerId: "" },
      sort: "name_asc", visibleColumns: ["name"],
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

describe("contact detail activity timeline", () => {
  it("loads the creator and system flag needed to authorize activity edits, scoped to this contact", async () => {
    const activities = [{ id: "activity-1", activity_type: "call", subject: "Call", body: null, occurred_at: "2026-04-03T12:00:00Z", created_by: userId, owner_id: userId, is_system_event: false }];
    const { supabase, activityCalls } = timelineClient({ id: "contact-1", workspace_id: workspaceId, company_id: null, owner_id: null }, activities);

    const detail = await getContactDetail(supabase as never, workspaceId, "contact-1");

    const selected = String(activityCalls.find(([method]) => method === "select")?.[1][0]);
    expect(selected.split(",").map((column) => column.trim())).toEqual(expect.arrayContaining(["id", "created_by", "is_system_event"]));
    expect(activityCalls.filter(([method]) => method === "eq").map(([, args]) => args)).toEqual([["workspace_id", workspaceId], ["related_entity_type", "contact"], ["related_entity_id", "contact-1"]]);
    expect(detail?.activities).toEqual(activities);
  });
});
