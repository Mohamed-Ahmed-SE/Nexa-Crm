import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the Supabase client boundary (and Next/auth framework edges) is mocked; the real actions and schemas run.
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  parentEq: vi.fn(), parentIs: vi.fn(), parentMaybeSingle: vi.fn(),
  lookupEq: vi.fn(), lookupMaybeSingle: vi.fn(),
  update: vi.fn(), updateEq: vi.fn(), updateMaybeSingle: vi.fn(),
  remove: vi.fn(), removeEq: vi.fn(), removeMaybeSingle: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { deleteCompanyNoteAction, updateCompanyNoteAction } from "./companies/actions";
import { deleteContactNoteAction, updateContactNoteAction } from "./contacts/actions";
import { deleteDealNoteAction, updateDealNoteAction } from "./deals/[id]/engagement-actions";
import { deleteLeadNoteAction, updateLeadNoteAction } from "./leads/engagement-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const parentId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const noteId = "a1100000-0000-4000-8000-000000000001";
const userId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";
const otherUserId = "d3e759d7-9e9f-4b27-81d5-83f4d42d72b3";

type ActionResult = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
type NoteAction = (previous: ActionResult, form: FormData) => Promise<ActionResult>;
type Entity = {
  name: string; table: string; idField: string; type: string; path: string;
  update: NoteAction; remove: NoteAction; notEditableMessage: string;
};

const entities: Entity[] = [
  { name: "contact", table: "contacts", idField: "contactId", type: "contact", path: `/app/contacts/${parentId}`, update: updateContactNoteAction, remove: deleteContactNoteAction, notEditableMessage: "You can update only contacts assigned to you." },
  { name: "company", table: "companies", idField: "companyId", type: "company", path: `/app/companies/${parentId}`, update: updateCompanyNoteAction, remove: deleteCompanyNoteAction, notEditableMessage: "You can update only companies assigned to you." },
  { name: "deal", table: "deals", idField: "dealId", type: "deal", path: `/app/deals/${parentId}`, update: updateDealNoteAction, remove: deleteDealNoteAction, notEditableMessage: "You can update only deals assigned to you." },
  { name: "lead", table: "leads", idField: "leadId", type: "lead", path: `/app/leads/${parentId}`, update: updateLeadNoteAction, remove: deleteLeadNoteAction, notEditableMessage: "You can update only leads assigned to you." },
];

type Overrides = {
  parent?: { data: { id: string; owner_id: string; status: string } | null; error: unknown };
  note?: { data: { id: string; created_by: string } | null; error: unknown };
  write?: { data: { id: string } | null; error: unknown };
};

function setupQueries({ parent = { data: { id: parentId, owner_id: userId, status: "open" }, error: null }, note = { data: { id: noteId, created_by: userId }, error: null }, write = { data: { id: noteId }, error: null } }: Overrides = {}) {
  const parentQuery = {
    eq: mocks.parentEq.mockReturnThis(), is: mocks.parentIs.mockReturnThis(),
    maybeSingle: mocks.parentMaybeSingle.mockResolvedValue(parent),
  };
  const lookupQuery = { eq: mocks.lookupEq.mockReturnThis(), maybeSingle: mocks.lookupMaybeSingle.mockResolvedValue(note) };
  const writeQuery = (eq: typeof mocks.updateEq, maybeSingle: typeof mocks.updateMaybeSingle) => ({
    eq: eq.mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: maybeSingle.mockResolvedValue(write),
  });
  mocks.update.mockReturnValue(writeQuery(mocks.updateEq, mocks.updateMaybeSingle));
  mocks.remove.mockReturnValue(writeQuery(mocks.removeEq, mocks.removeMaybeSingle));
  mocks.from.mockImplementation((table: string) => table === "notes"
    ? { select: vi.fn().mockReturnValue(lookupQuery), update: mocks.update, delete: mocks.remove }
    : { select: vi.fn().mockReturnValue(parentQuery) });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

function noteForm(entity: Entity, { parent = parentId, note = noteId, body }: { parent?: string; note?: string; body?: string } = {}) {
  const form = new FormData();
  form.set(entity.idField, parent);
  form.set("noteId", note);
  if (body !== undefined) form.set("body", body);
  return form;
}

describe.each(entities)("$name note edit and delete actions", (entity) => {
  const scopedEq = (eq: typeof mocks.updateEq) => {
    expect(eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(eq).toHaveBeenNthCalledWith(2, "related_entity_type", entity.type);
    expect(eq).toHaveBeenNthCalledWith(3, "related_entity_id", parentId);
    expect(eq).toHaveBeenNthCalledWith(4, "id", noteId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries();
  });

  describe("update", () => {
    it("updates only the trimmed body for the creator, scoped by workspace, entity and note, then revalidates", async () => {
      await expect(entity.update({}, noteForm(entity, { body: "  Revised terms  " }))).resolves.toEqual({ ok: true, message: "Note updated." });

      expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
      scopedEq(mocks.lookupEq);
      expect(mocks.update).toHaveBeenCalledWith({ body: "Revised terms" });
      scopedEq(mocks.updateEq);
      expect(mocks.revalidatePath).toHaveBeenCalledWith(entity.path);
    });

    it("lets a user with crm.edit.all update a note created by someone else", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null }, note: { data: { id: noteId, created_by: otherUserId }, error: null } });

      await expect(entity.update({}, noteForm(entity, { body: "Manager edit" }))).resolves.toEqual({ ok: true, message: "Note updated." });
      expect(mocks.update).toHaveBeenCalledWith({ body: "Manager edit" });
    });

    it("rejects a member editing another creator’s note without writing", async () => {
      setupQueries({ note: { data: { id: noteId, created_by: otherUserId }, error: null } });

      await expect(entity.update({}, noteForm(entity, { body: "Hijack" }))).resolves.toEqual({ message: "You can update only your own notes." });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects a member whose parent record is assigned to someone else before looking up the note", async () => {
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null } });

      await expect(entity.update({}, noteForm(entity, { body: "Edit" }))).resolves.toEqual({ message: entity.notEditableMessage });
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rejects a missing or archived parent (looked up with archived_at is null) before touching notes", async () => {
      setupQueries({ parent: { data: null, error: null } });

      const result = await entity.update({}, noteForm(entity, { body: "Edit" }));
      expect(result.ok).toBeUndefined();
      expect(result.message).toMatch(/not found in this workspace/);
      expect(mocks.parentIs).toHaveBeenCalledWith("archived_at", null);
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid parent id", { parent: "not-a-uuid", body: "Edit" }],
      ["invalid note id", { note: "not-a-uuid", body: "Edit" }],
    ])("rejects an %s before contacting the database", async (_label, options) => {
      await expect(entity.update({}, noteForm(entity, options))).resolves.toEqual({ message: "This note could not be identified." });
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it.each([
      ["blank", "   "],
      ["too long", "x".repeat(10001)],
    ])("rejects a %s body with field errors and no write", async (_label, body) => {
      const result = await entity.update({}, noteForm(entity, { body }));

      expect(result.message).toBe("Enter a note before saving.");
      expect(result.fieldErrors?.body?.length).toBeGreaterThan(0);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("accepts a body of exactly 10000 characters", async () => {
      await expect(entity.update({}, noteForm(entity, { body: "x".repeat(10000) }))).resolves.toEqual({ ok: true, message: "Note updated." });
    });

    it.each([
      ["missing or cross-entity note", { data: null, error: null }],
      ["note lookup database error", { data: null, error: new Error("database unavailable") }],
    ])("reports a refresh message and does not write for a %s", async (_label, note) => {
      setupQueries({ note });

      await expect(entity.update({}, noteForm(entity, { body: "Edit" }))).resolves.toEqual({ message: `Note could not be updated. Refresh the ${entity.name} and try again.` });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["RLS no-row update", { data: null, error: null }],
      ["database update error", { data: null, error: new Error("database unavailable") }],
    ])("reports failure and skips revalidation for a %s", async (_label, write) => {
      setupQueries({ write });

      await expect(entity.update({}, noteForm(entity, { body: "Edit" }))).resolves.toEqual({ message: `Note could not be updated. Refresh the ${entity.name} and try again.` });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propagates a permission failure without creating a database client", async () => {
      mocks.requirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(entity.update({}, noteForm(entity, { body: "Edit" }))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes the creator’s note scoped by workspace, entity and note, then revalidates", async () => {
      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ ok: true, message: "Note deleted." });

      expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
      scopedEq(mocks.lookupEq);
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      scopedEq(mocks.removeEq);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith(entity.path);
    });

    it("lets a user with crm.edit.all delete a note created by someone else", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null }, note: { data: { id: noteId, created_by: otherUserId }, error: null } });

      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ ok: true, message: "Note deleted." });
    });

    it("rejects a member deleting another creator’s note without deleting", async () => {
      setupQueries({ note: { data: { id: noteId, created_by: otherUserId }, error: null } });

      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ message: "You can delete only your own notes." });
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects a member whose parent record is assigned to someone else before looking up the note", async () => {
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null } });

      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ message: entity.notEditableMessage });
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("rejects a missing or archived parent before touching notes", async () => {
      setupQueries({ parent: { data: null, error: null } });

      const result = await entity.remove({}, noteForm(entity));
      expect(result.message).toMatch(/not found in this workspace/);
      expect(mocks.parentIs).toHaveBeenCalledWith("archived_at", null);
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid parent id", { parent: "not-a-uuid" }],
      ["invalid note id", { note: "not-a-uuid" }],
    ])("rejects an %s before contacting the database", async (_label, options) => {
      await expect(entity.remove({}, noteForm(entity, options))).resolves.toEqual({ message: "This note could not be identified." });
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it.each([
      ["missing or cross-entity note", { data: null, error: null }],
      ["note lookup database error", { data: null, error: new Error("database unavailable") }],
    ])("reports a refresh message and does not delete for a %s", async (_label, note) => {
      setupQueries({ note });

      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ message: `Note could not be deleted. Refresh the ${entity.name} and try again.` });
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["RLS no-row delete", { data: null, error: null }],
      ["database delete error", { data: null, error: new Error("database unavailable") }],
    ])("reports failure and skips revalidation for a %s", async (_label, write) => {
      setupQueries({ write });

      await expect(entity.remove({}, noteForm(entity))).resolves.toEqual({ message: `Note could not be deleted. Refresh the ${entity.name} and try again.` });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propagates a permission failure without creating a database client", async () => {
      mocks.requirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(entity.remove({}, noteForm(entity))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });
  });
});
