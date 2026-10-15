import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(),
  from: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { deleteCompanyViewAction, saveCompanyViewAction } from "./saved-view-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const viewId = "83d8aaf1-c78e-41db-ae18-493f44c84b42";

function companyViewForm() {
  const form = new FormData();
  form.set("name", " Active accounts ");
  form.set("q", "Acme");
  form.set("ownerId", "unassigned");
  form.set("sort", "industry_desc");
  form.append("visibleColumns", "company");
  form.append("visibleColumns", "owner");
  return form;
}

function setupActions() {
  const deleteQuery = { eq: mocks.eq.mockReturnThis() };
  mocks.delete.mockReturnValue(deleteQuery);
  mocks.from.mockReturnValue({ insert: mocks.insert, delete: mocks.delete });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("company saved-view actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.eq.mockReturnThis();
    setupActions();
  });

  it("saves validated company settings with authenticated workspace and user identity", async () => {
    const form = companyViewForm();
    form.set("workspaceId", "attacker-workspace");
    form.set("userId", "attacker-user");

    expect(await saveCompanyViewAction({}, form)).toEqual({ ok: true, message: "View saved." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.view");
    expect(mocks.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId, user_id: userId, entity_type: "companies", name: "Active accounts",
      filters: { q: "Acme", ownerId: "unassigned" }, sort: "industry_desc", visible_columns: ["company", "owner"],
    });
  });

  it("rejects invalid sort and columns before persisting", async () => {
    const form = companyViewForm();
    form.set("sort", "owner_desc");
    form.append("visibleColumns", "company");

    expect(await saveCompanyViewAction({}, form)).toEqual({ message: "Enter a name and choose at least one valid column." });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("deletes only the view owned by the authenticated workspace user and Companies entity", async () => {
    const form = new FormData();
    form.set("id", viewId);

    expect(await deleteCompanyViewAction({}, form)).toEqual({ ok: true, message: "View deleted." });
    expect(mocks.from).toHaveBeenCalledWith("saved_views");
    expect(mocks.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId], ["user_id", userId], ["entity_type", "companies"], ["id", viewId],
    ]);
  });
});
