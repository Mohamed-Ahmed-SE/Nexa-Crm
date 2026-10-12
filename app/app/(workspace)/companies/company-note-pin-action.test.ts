import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  companyMaybeSingle: vi.fn(), companyEq: vi.fn(), companyIs: vi.fn(),
  noteLookupMaybeSingle: vi.fn(), noteLookupEq: vi.fn(), noteUpdateMaybeSingle: vi.fn(), noteUpdate: vi.fn(), noteUpdateEq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { toggleCompanyNotePinnedAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const companyId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const noteId = "a1100000-0000-4000-8000-000000000001";
const userId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";

function noteForm(company = companyId, note = noteId) {
  const form = new FormData();
  form.set("companyId", company);
  form.set("noteId", note);
  return form;
}

type NoteRow = { id: string; is_pinned: boolean; created_by: string };
type UpdateResponse = { data: { id: string } | null; error: unknown | null };

function setupQueries({ note = { id: noteId, is_pinned: false, created_by: userId }, lookupError = null, update = { data: { id: noteId }, error: null } }: {
  note?: NoteRow | null; lookupError?: unknown | null; update?: UpdateResponse;
} = {}) {
  const companyQuery = { eq: mocks.companyEq.mockReturnThis(), is: mocks.companyIs.mockReturnThis(), maybeSingle: mocks.companyMaybeSingle };
  const noteLookup = { eq: mocks.noteLookupEq.mockReturnThis(), maybeSingle: mocks.noteLookupMaybeSingle.mockResolvedValue({ data: note, error: lookupError }) };
  const noteUpdateQuery = { eq: mocks.noteUpdateEq.mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: mocks.noteUpdateMaybeSingle.mockResolvedValue(update) };
  mocks.noteUpdate.mockReturnValue(noteUpdateQuery);
  mocks.from.mockImplementation((table: string) => table === "companies"
    ? { select: vi.fn().mockReturnValue(companyQuery) }
    : { select: vi.fn().mockReturnValue(noteLookup), update: mocks.noteUpdate });
  mocks.companyMaybeSingle.mockResolvedValue({ data: { id: companyId, owner_id: userId }, error: null });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("toggleCompanyNotePinnedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
    setupQueries();
  });

  it("scopes the lookup and update, then pins for a manager and revalidates the company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    setupQueries({ note: { id: noteId, is_pinned: false, created_by: "another-user" } });

    await expect(toggleCompanyNotePinnedAction({}, noteForm())).resolves.toEqual({ ok: true, message: "Note pinned." });

    expect(mocks.noteLookupEq.mock.calls).toEqual([
      ["workspace_id", workspaceId], ["related_entity_type", "company"], ["related_entity_id", companyId], ["id", noteId],
    ]);
    expect(mocks.noteUpdate).toHaveBeenCalledWith({ is_pinned: true });
    expect(mocks.noteUpdateEq.mock.calls).toEqual(mocks.noteLookupEq.mock.calls);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/companies/${companyId}`);
  });

  it.each([
    ["invalid company UUID", "invalid", noteId],
    ["invalid note UUID", companyId, "invalid"],
  ])("rejects %s before database access", async (_scenario, invalidCompany, invalidNote) => {
    await expect(toggleCompanyNotePinnedAction({}, noteForm(invalidCompany, invalidNote))).resolves.toEqual({ message: "This note could not be identified." });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["missing company", null, null, "Company not found in this workspace."],
    ["company lookup failure", null, new Error("database unavailable"), "Company not found in this workspace."],
  ])("does not query notes after a %s", async (_scenario, company, error, message) => {
    mocks.companyMaybeSingle.mockResolvedValue({ data: company, error });

    await expect(toggleCompanyNotePinnedAction({}, noteForm())).resolves.toEqual({ message });
    expect(mocks.noteLookupEq).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("prevents a member from changing another creator’s note on an editable company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries({ note: { id: noteId, is_pinned: false, created_by: "another-user" } });

    await expect(toggleCompanyNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "You can update only your own notes." });
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not look up a note when the member cannot edit the company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries();
    mocks.companyMaybeSingle.mockResolvedValue({ data: { id: companyId, owner_id: "another-user" }, error: null });

    await expect(toggleCompanyNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "You can update only companies assigned to you." });
    expect(mocks.noteLookupEq).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["note lookup failure", null, new Error("database unavailable"), { data: { id: noteId }, error: null }],
    ["missing or cross-company note", null, null, { data: { id: noteId }, error: null }],
    ["database update failure", { id: noteId, is_pinned: false, created_by: userId }, null, { data: null, error: new Error("database unavailable") }],
    ["RLS no-row update", { id: noteId, is_pinned: false, created_by: userId }, null, { data: null, error: null }],
  ])("reports failure without revalidation after %s", async (_scenario, note, lookupError, update) => {
    setupQueries({ note, lookupError, update });

    await expect(toggleCompanyNotePinnedAction({}, noteForm())).resolves.toEqual({ message: "Note could not be updated. Refresh the company and try again." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
