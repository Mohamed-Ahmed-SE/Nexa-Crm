import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { deleteLeadViewAction, saveLeadViewAction } from "./saved-view-actions";

function viewForm() {
  const form = new FormData();
  form.set("name", "Qualified this week");
  form.set("q", "Acme");
  form.set("status", "qualified");
  form.set("sourceId", "");
  form.set("ownerId", "unassigned");
  form.set("sort", "value_desc");
  form.append("visibleColumns", "name");
  form.append("visibleColumns", "value");
  return form;
}

describe("saved lead view actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId: "5a4302eb-742b-49cb-9f0d-bfc96e9474c3", userId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2" });
    mocks.eq.mockReturnThis();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.delete.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ from: () => ({ insert: mocks.insert, delete: () => ({ eq: mocks.eq }) }) });
  });

  it("persists the validated current view under the authorized user and workspace", async () => {
    const result = await saveLeadViewAction({}, viewForm());

    expect(result).toEqual({ ok: true, message: "View saved." });
    expect(mocks.insert).toHaveBeenCalledWith({
      workspace_id: "5a4302eb-742b-49cb-9f0d-bfc96e9474c3",
      user_id: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2",
      entity_type: "leads",
      name: "Qualified this week",
      filters: { q: "Acme", status: "qualified", sourceId: "", ownerId: "unassigned" },
      sort: "value_desc",
      visible_columns: ["name", "value"],
    });
  });

  it("does not persist client-supplied query columns or malformed filters", async () => {
    const form = viewForm();
    form.set("sort", "id_desc");
    form.set("status", "all);delete from leads");

    const result = await saveLeadViewAction({}, form);

    expect(result.ok).toBeUndefined();
    expect(result.message).toMatch(/valid column/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed delete identifier without affecting a saved view", async () => {
    const form = new FormData();
    form.set("id", "not-a-uuid");

    const result = await deleteLeadViewAction({}, form);

    expect(result).toEqual({ message: "This saved view could not be identified." });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
