import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchWorkspaceAction } from "@/lib/auth/workspace-actions";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    query,
    cookieSet: vi.fn(),
    getUser: vi.fn(),
    redirect: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => mocks.query,
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookieSet }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("workspace switching action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("returns a generic rejection without changing the persisted choice for an inactive membership", async () => {
    const formData = new FormData();
    formData.set("workspaceId", "11111111-1111-4111-8111-111111111111");

    const state = await switchWorkspaceAction({ error: null }, formData);

    expect(state.error).toMatch(/current workspace is unchanged/);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns a rejection for malformed form data without authenticating or changing the choice", async () => {
    const formData = new FormData();
    formData.set("workspaceId", "not-a-workspace-id");

    const state = await switchWorkspaceAction({ error: null }, formData);

    expect(state.error).toMatch(/current workspace is unchanged/);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns a rejection when the authenticated session has no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const formData = new FormData();
    formData.set("workspaceId", "11111111-1111-4111-8111-111111111111");

    const state = await switchWorkspaceAction({ error: null }, formData);

    expect(state.error).toMatch(/current workspace is unchanged/);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
