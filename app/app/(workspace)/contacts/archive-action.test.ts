import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { archiveContactAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const contactId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

function archiveForm(id: string) {
  const form = new FormData();
  form.set("id", id);
  return form;
}

function setupArchiveQuery(response: { data: { id: string } | null; error: unknown }) {
  const query = {
    eq: mocks.eq.mockReturnThis(),
    is: mocks.is.mockReturnThis(),
    select: mocks.select.mockReturnThis(),
    maybeSingle: mocks.maybeSingle.mockResolvedValue(response),
  };
  mocks.from.mockReturnValue({ update: mocks.update.mockReturnValue(query) });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("archiveContactAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId: "user-1", role: "admin" });
    setupArchiveQuery({ data: { id: contactId }, error: null });
  });

  it("requires archive permission before mutating contacts", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));

    await expect(archiveContactAction({}, archiveForm(contactId))).rejects.toThrow("Forbidden");

    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.archive");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs without querying contacts", async () => {
    const response = await archiveContactAction({}, archiveForm("not-a-uuid"));

    expect(response).toEqual({ message: "This contact could not be identified." });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updates only the active contact in the authorized workspace and revalidates the list", async () => {
    const response = await archiveContactAction({}, archiveForm(contactId));

    expect(response).toEqual({ ok: true, message: "Contact archived." });
    expect(mocks.from).toHaveBeenCalledWith("contacts");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "id", contactId);
    expect(mocks.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.select).toHaveBeenCalledWith("id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/contacts");
  });

  it.each([
    [{ data: null, error: null }, "Contact not found or already archived."],
    [{ data: null, error: new Error("database unavailable") }, "Unable to archive this contact. Refresh the list and try again."],
  ])("reports failure and does not revalidate when the row is missing or update fails", async (response, message) => {
    setupArchiveQuery(response);

    expect(await archiveContactAction({}, archiveForm(contactId))).toEqual({ message });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
