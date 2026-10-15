import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the Supabase client boundary (and Next/auth framework edges) is mocked; the real actions, schemas and helpers run.
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

import { deleteCompanyActivityAction, updateCompanyActivityAction } from "./companies/actions";
import { deleteContactActivityAction, updateContactActivityAction } from "./contacts/actions";
import { deleteDealActivityAction, updateDealActivityAction } from "./deals/[id]/engagement-actions";
import { deleteLeadActivityAction, updateLeadActivityAction } from "./leads/engagement-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const parentId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const activityId = "a1100000-0000-4000-8000-000000000001";
const userId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";
const otherUserId = "d3e759d7-9e9f-4b27-81d5-83f4d42d72b3";

type ActionResult = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
type ActivityAction = (previous: ActionResult, form: FormData) => Promise<ActionResult>;
type Entity = {
  name: string; idField: string; type: string; path: string;
  update: ActivityAction; remove: ActivityAction; notEditableMessage: string;
};

const entities: Entity[] = [
  { name: "contact", idField: "contactId", type: "contact", path: `/app/contacts/${parentId}`, update: updateContactActivityAction, remove: deleteContactActivityAction, notEditableMessage: "You can update only contacts assigned to you." },
  { name: "company", idField: "companyId", type: "company", path: `/app/companies/${parentId}`, update: updateCompanyActivityAction, remove: deleteCompanyActivityAction, notEditableMessage: "You can update only companies assigned to you." },
  { name: "deal", idField: "dealId", type: "deal", path: `/app/deals/${parentId}`, update: updateDealActivityAction, remove: deleteDealActivityAction, notEditableMessage: "You can update only deals assigned to you." },
  { name: "lead", idField: "leadId", type: "lead", path: `/app/leads/${parentId}`, update: updateLeadActivityAction, remove: deleteLeadActivityAction, notEditableMessage: "You can update only leads assigned to you." },
];

type ActivityRow = { id: string; created_by: string; is_system_event: boolean; activity_type: string };
type Overrides = {
  parent?: { data: { id: string; owner_id: string; status: string } | null; error: unknown };
  activity?: { data: ActivityRow | null; error: unknown };
  write?: { data: { id: string } | null; error: unknown };
};
const ownActivity: ActivityRow = { id: activityId, created_by: userId, is_system_event: false, activity_type: "call" };

function setupQueries({ parent = { data: { id: parentId, owner_id: userId, status: "open" }, error: null }, activity = { data: ownActivity, error: null }, write = { data: { id: activityId }, error: null } }: Overrides = {}) {
  const parentQuery = {
    eq: mocks.parentEq.mockReturnThis(), is: mocks.parentIs.mockReturnThis(),
    maybeSingle: mocks.parentMaybeSingle.mockResolvedValue(parent),
  };
  const lookupQuery = { eq: mocks.lookupEq.mockReturnThis(), maybeSingle: mocks.lookupMaybeSingle.mockResolvedValue(activity) };
  const writeQuery = (eq: typeof mocks.updateEq, maybeSingle: typeof mocks.updateMaybeSingle) => ({
    eq: eq.mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: maybeSingle.mockResolvedValue(write),
  });
  mocks.update.mockReturnValue(writeQuery(mocks.updateEq, mocks.updateMaybeSingle));
  mocks.remove.mockReturnValue(writeQuery(mocks.removeEq, mocks.removeMaybeSingle));
  mocks.from.mockImplementation((table: string) => table === "activities"
    ? { select: vi.fn().mockReturnValue(lookupQuery), update: mocks.update, delete: mocks.remove }
    : { select: vi.fn().mockReturnValue(parentQuery) });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

type FormOptions = { parent?: string; activity?: string; type?: string; subject?: string; body?: string; occurredAt?: string; timezoneOffset?: string };
function activityForm(entity: Entity, { parent = parentId, activity = activityId, type = "meeting", subject = "Renewal meeting", body = "Agreed on terms", occurredAt = "2026-05-01T09:30", timezoneOffset = "0" }: FormOptions = {}) {
  const form = new FormData();
  form.set(entity.idField, parent);
  form.set("activityId", activity);
  form.set("type", type);
  form.set("subject", subject);
  form.set("body", body);
  form.set("occurredAt", occurredAt);
  form.set("timezoneOffset", timezoneOffset);
  return form;
}

describe.each(entities)("$name activity edit and delete actions", (entity) => {
  const scopedEq = (eq: typeof mocks.updateEq) => {
    expect(eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(eq).toHaveBeenNthCalledWith(2, "related_entity_type", entity.type);
    expect(eq).toHaveBeenNthCalledWith(3, "related_entity_id", parentId);
    expect(eq).toHaveBeenNthCalledWith(4, "id", activityId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupQueries();
  });

  describe("update", () => {
    it("updates only type, subject, body and occurred_at for the creator, scoped by workspace, entity and activity, then revalidates", async () => {
      await expect(entity.update({}, activityForm(entity, { subject: "  Renewal meeting  ", body: "  Agreed on terms  ", occurredAt: "2026-05-01T09:30", timezoneOffset: "-120" }))).resolves.toEqual({ ok: true, message: "Activity updated." });

      expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
      scopedEq(mocks.lookupEq);
      expect(mocks.update).toHaveBeenCalledWith({ activity_type: "meeting", subject: "Renewal meeting", body: "Agreed on terms", occurred_at: "2026-05-01T07:30:00.000Z" });
      scopedEq(mocks.updateEq);
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith(entity.path);
    });

    it("stores a blank description as null", async () => {
      await expect(entity.update({}, activityForm(entity, { body: "   " }))).resolves.toEqual({ ok: true, message: "Activity updated." });
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ body: null }));
    });

    it("lets an admin update an activity created by someone else", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null }, activity: { data: { ...ownActivity, created_by: otherUserId }, error: null } });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ ok: true, message: "Activity updated." });
      expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it("lets a manager update an activity they created", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ ok: true, message: "Activity updated." });
    });

    it("rejects a manager editing another creator’s activity even though they hold crm.edit.all", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
      setupQueries({ activity: { data: { ...ownActivity, created_by: otherUserId }, error: null } });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: "You can update only activities you created." });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects a member editing another creator’s activity without writing", async () => {
      setupQueries({ activity: { data: { ...ownActivity, created_by: otherUserId }, error: null } });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: "You can update only activities you created." });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([
      ["a system event", { ...ownActivity, is_system_event: true }],
      ["a system-generated type that is not flagged as a system event", { ...ownActivity, activity_type: "owner_changed" }],
    ])("rejects %s even for its creator or an admin", async (_label, row) => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
      setupQueries({ activity: { data: row, error: null } });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: "System-generated activities cannot be changed." });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects a member whose parent record is assigned to someone else before looking up the activity", async () => {
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null } });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: entity.notEditableMessage });
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rejects a missing parent before touching activities", async () => {
      setupQueries({ parent: { data: null, error: null } });

      const result = await entity.update({}, activityForm(entity));
      expect(result.ok).toBeUndefined();
      expect(result.message).toMatch(/not found in this workspace/);
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid parent id", { parent: "not-a-uuid" }],
      ["invalid activity id", { activity: "not-a-uuid" }],
    ])("rejects an %s before contacting the database", async (_label, options) => {
      await expect(entity.update({}, activityForm(entity, options))).resolves.toEqual({ message: "This activity could not be identified." });
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it.each([
      ["blank subject", { subject: "   " }, "subject"],
      ["too long subject", { subject: "x".repeat(201) }, "subject"],
      ["system-generated type", { type: "stage_changed" }, "type"],
      ["unknown type", { type: "fax" }, "type"],
      ["too long description", { body: "x".repeat(5001) }, "body"],
      ["invalid time", { occurredAt: "yesterday" }, "occurredAt"],
    ])("rejects a %s with field errors and no write", async (_label, options, field) => {
      const result = await entity.update({}, activityForm(entity, options));

      expect(result.ok).toBeUndefined();
      expect(result.message).toBe("Check the activity details.");
      expect(result.fieldErrors?.[field]?.length).toBeGreaterThan(0);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["missing or cross-entity activity", { data: null, error: null }],
      ["activity lookup database error", { data: null, error: new Error("database unavailable") }],
    ])("reports a refresh message and does not write for a %s", async (_label, activity) => {
      setupQueries({ activity });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: `Activity could not be updated. Refresh the ${entity.name} and try again.` });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["RLS no-row update", { data: null, error: null }],
      ["database update error", { data: null, error: new Error("database unavailable") }],
    ])("reports failure and skips revalidation for a %s", async (_label, write) => {
      setupQueries({ write });

      await expect(entity.update({}, activityForm(entity))).resolves.toEqual({ message: `Activity could not be updated. Refresh the ${entity.name} and try again.` });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propagates a permission failure without creating a database client", async () => {
      mocks.requirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(entity.update({}, activityForm(entity))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes the creator’s activity scoped by workspace, entity and activity, then revalidates", async () => {
      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ ok: true, message: "Activity deleted." });

      expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
      scopedEq(mocks.lookupEq);
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      scopedEq(mocks.removeEq);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith(entity.path);
    });

    it("lets an admin delete an activity created by someone else", async () => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null }, activity: { data: { ...ownActivity, created_by: otherUserId }, error: null } });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ ok: true, message: "Activity deleted." });
    });

    it.each([
      ["manager", "manager"],
      ["member", "member"],
    ])("rejects a %s deleting another creator’s activity without deleting", async (_label, role) => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role });
      setupQueries({ activity: { data: { ...ownActivity, created_by: otherUserId }, error: null } });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ message: "You can delete only activities you created." });
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["a system event", { ...ownActivity, is_system_event: true }],
      ["a system-generated type that is not flagged as a system event", { ...ownActivity, activity_type: "status_changed" }],
    ])("rejects deleting %s even for an admin", async (_label, row) => {
      mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "admin" });
      setupQueries({ activity: { data: row, error: null } });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ message: "System-generated activities cannot be changed." });
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("rejects a member whose parent record is assigned to someone else before looking up the activity", async () => {
      setupQueries({ parent: { data: { id: parentId, owner_id: otherUserId, status: "open" }, error: null } });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ message: entity.notEditableMessage });
      expect(mocks.lookupEq).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid parent id", { parent: "not-a-uuid" }],
      ["invalid activity id", { activity: "not-a-uuid" }],
    ])("rejects an %s before contacting the database", async (_label, options) => {
      await expect(entity.remove({}, activityForm(entity, options))).resolves.toEqual({ message: "This activity could not be identified." });
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it.each([
      ["missing or cross-entity activity", { data: null, error: null }],
      ["activity lookup database error", { data: null, error: new Error("database unavailable") }],
    ])("reports a refresh message and does not delete for a %s", async (_label, activity) => {
      setupQueries({ activity });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ message: `Activity could not be deleted. Refresh the ${entity.name} and try again.` });
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["RLS no-row delete", { data: null, error: null }],
      ["database delete error", { data: null, error: new Error("database unavailable") }],
    ])("reports failure and skips revalidation for a %s", async (_label, write) => {
      setupQueries({ write });

      await expect(entity.remove({}, activityForm(entity))).resolves.toEqual({ message: `Activity could not be deleted. Refresh the ${entity.name} and try again.` });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propagates a permission failure without creating a database client", async () => {
      mocks.requirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(entity.remove({}, activityForm(entity))).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    });
  });
});
