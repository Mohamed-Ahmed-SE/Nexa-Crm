import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(),
  from: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { deleteContactViewAction, saveContactViewAction } from "./saved-view-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const viewId = "83d8aaf1-c78e-41db-ae18-493f44c84b42";

function savedViewForm() {
  const form = new FormData();
  form.set("name", " Active accounts ");
  form.set("q", "Acme");
  form.set("lifecycle", "customer");
  form.set("companyId", "");
  form.set("ownerId", "unassigned");
  form.set("sort", "name_desc");
  form.append("visibleColumns", "name");
  form.append("visibleColumns", "lifecycle");
  return form;
}

function setupActions() {
  const deleteQuery = { eq: mocks.eq.mockReturnThis() };
  mocks.delete.mockReturnValue(deleteQuery);
  mocks.from.mockReturnValue({ insert: mocks.insert, delete: mocks.delete });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("contact saved-view actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.eq.mockReturnThis();
    setupActions();
  });

  it("saves validated Contacts settings using only authenticated identity", async () => {
    const form = savedViewForm();
    form.set("workspaceId", "attacker-workspace");
    form.set("userId", "attacker-user");
    const result = await saveContactViewAction({}, form);

    expect(result).toEqual({ ok: true, message: "View saved." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.view");
    expect(mocks.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId, user_id: userId, entity_type: "contacts", name: "Active accounts",
      filters: { q: "Acme", lifecycle: "customer", companyId: "", ownerId: "unassigned" },
      sort: "name_desc", visible_columns: ["name", "lifecycle"],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/contacts");
  });

  it("rejects unsupported filters before writing a saved view", async () => {
    const form = savedViewForm();
    form.set("lifecycle", "qualified");

    expect(await saveContactViewAction({}, form)).toEqual({ message: "Enter a name and choose at least one valid column." });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("deletes only the identified view owned by this workspace user and entity", async () => {
    const form = new FormData();
    form.set("id", viewId);

    expect(await deleteContactViewAction({}, form)).toEqual({ ok: true, message: "View deleted." });
    expect(mocks.from).toHaveBeenCalledWith("saved_views");
    expect(mocks.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId], ["user_id", userId], ["entity_type", "contacts"], ["id", viewId],
    ]);
  });
});
