import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  contactMaybeSingle: vi.fn(), noteLookupMaybeSingle: vi.fn(), noteUpdateMaybeSingle: vi.fn(), noteUpdate: vi.fn(),
  contactEq: vi.fn(), contactIs: vi.fn(), noteLookupEq: vi.fn(), noteUpdateEq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { toggleContactNotePinnedAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const contactId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const noteId = "a1100000-0000-4000-8000-000000000001";
const userId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";

function noteForm(contact = contactId, note = noteId) {
  const form = new FormData();
  form.set("contactId", contact);
  form.set("noteId", note);
  return form;
}

type NoteRow = { id: string; is_pinned: boolean; created_by: string };
type QueryResponse = { data: NoteRow | null; error: unknown | null };
type UpdateResponse = { data: { id: string } | null; error: unknown | null };

function setupQueries({ note = { id: noteId, is_pinned: false, created_by: userId }, lookupError = null, update = { data: { id: noteId }, error: null } }: {
  note?: NoteRow | null; lookupError?: unknown | null; update?: UpdateResponse;
} = {}) {
  const contactQuery = { eq: mocks.contactEq.mockReturnThis(), is: mocks.contactIs.mockReturnThis(), maybeSingle: mocks.contactMaybeSingle };
  const noteLookupResponse: QueryResponse = { data: note, error: lookupError };
  const noteLookup = { eq: mocks.noteLookupEq.mockReturnThis(), maybeSingle: mocks.noteLookupMaybeSingle.mockResolvedValue(noteLookupResponse) };
  const noteUpdate = { eq: mocks.noteUpdateEq.mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: mocks.noteUpdateMaybeSingle.mockResolvedValue(update) };
  mocks.noteUpdate.mockReturnValue(noteUpdate);
  mocks.from.mockImplementation((table: string) => table === "contacts"
    ? { select: vi.fn().mockReturnValue(contactQuery) }
    : { select: vi.fn().mockReturnValue(noteLookup), update: mocks.noteUpdate });
  mocks.contactMaybeSingle.mockResolvedValue({ data: { id: contactId, owner_id: userId }, error: null });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("toggleContactNotePinnedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
    setupQueries();
  });

  it("toggles an authorized note and revalidates the contact detail route", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    setupQueries({ note: { id: noteId, is_pinned: false, created_by: "another-user" } });

    await expect(toggleContactNotePinnedAction({}, noteForm())).resolves.toEqual({ ok: true, message: "Note pinned." });

    expect(mocks.noteLookupEq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(mocks.noteLookupEq).toHaveBeenNthCalledWith(2, "related_entity_type", "contact");
    expect(mocks.noteLookupEq).toHaveBeenNthCalledWith(3, "related_entity_id", contactId);
    expect(mocks.noteLookupEq).toHaveBeenNthCalledWith(4, "id", noteId);
    expect(mocks.noteUpdate).toHaveBeenCalledWith({ is_pinned: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/contacts/${contactId}`);
  });

  it.each([
    ["invalid contact UUID", "not-a-uuid", noteId],
    ["invalid note UUID", contactId, "not-a-uuid"],
  ])("rejects %s before contacting the database", async (_scenario, invalidContactId, invalidNoteId) => {
    await expect(toggleContactNotePinnedAction({}, noteForm(invalidContactId, invalidNoteId))).resolves.toEqual({ message: "This note could not be identified." });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["missing or cross-contact note", { data: null, error: null }],
    ["note lookup database error", { data: null, error: new Error("database unavailable") }],
  ])("does not update or revalidate after a %s", async (_scenario, response) => {
    setupQueries({ note: response.data, lookupError: response.error });

    await expect(toggleContactNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "Note could not be updated. Refresh the contact and try again." });
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["RLS no-row update", { data: null, error: null }],
    ["database update error", { data: null, error: new Error("database unavailable") }],
  ])("reports failure and skips revalidation for a %s", async (_scenario, update) => {
    setupQueries({ update });

    await expect(toggleContactNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "Note could not be updated. Refresh the contact and try again." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("prevents a member from pinning another creator’s note despite an editable contact", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries({ note: { id: noteId, is_pinned: false, created_by: "another-user" } });

    await expect(toggleContactNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "You can update only your own notes." });
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not look up a note when a member cannot edit the contact", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries();
    mocks.contactMaybeSingle.mockResolvedValue({ data: { id: contactId, owner_id: "another-user" }, error: null });

    await expect(toggleContactNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "You can update only contacts assigned to you." });
    expect(mocks.noteLookupEq).not.toHaveBeenCalled();
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
