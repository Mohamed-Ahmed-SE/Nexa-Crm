import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listCompanySavedViews } from "@/lib/companies/repository";

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
