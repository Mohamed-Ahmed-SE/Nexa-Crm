import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  dealSelect: vi.fn(), dealEq: vi.fn(), dealIs: vi.fn(), dealMaybeSingle: vi.fn(),
  activityInsert: vi.fn(), noteInsert: vi.fn(), noteSelect: vi.fn(), noteEq: vi.fn(), noteMaybeSingle: vi.fn(),
  noteUpdate: vi.fn(), noteUpdateEq: vi.fn(), noteUpdateSelect: vi.fn(), noteUpdateMaybeSingle: vi.fn(), taskInsert: vi.fn(), rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { addDealNoteAction, createDealFollowUpTaskAction, logDealActivityAction, toggleDealNotePinAction } from "./engagement-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const dealId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const peerId = "1b661392-b532-49ba-b642-78e27f9a8844";

function dealForm(id = dealId) {
  const form = new FormData();
  form.set("dealId", id);
  return form;
}

function setupDeal(ownerId = userId, status: "open" | "won" | "lost" = "open", noteCreatedBy = userId) {
  const query = {
    select: mocks.dealSelect.mockReturnThis(), eq: mocks.dealEq.mockReturnThis(), is: mocks.dealIs.mockReturnThis(),
    maybeSingle: mocks.dealMaybeSingle.mockResolvedValue({ data: { id: dealId, owner_id: ownerId, status }, error: null }),
  };
  mocks.from.mockImplementation((table: string) => ({
    ...(table === "deals" ? query : {}),
    ...(table === "activities" ? { insert: mocks.activityInsert } : {}),
    ...(table === "notes" ? {
      insert: mocks.noteInsert,
      select: mocks.noteSelect.mockReturnThis(),
      eq: mocks.noteEq.mockReturnThis(),
      maybeSingle: mocks.noteMaybeSingle.mockResolvedValue({ data: { id: "e75c8819-b731-46e6-8443-91fa11a4ee58", is_pinned: false, created_by: noteCreatedBy }, error: null }),
      update: mocks.noteUpdate.mockReturnValue({ eq: mocks.noteUpdateEq.mockReturnThis(), select: mocks.noteUpdateSelect.mockReturnThis(), maybeSingle: mocks.noteUpdateMaybeSingle.mockResolvedValue({ data: { id: "e75c8819-b731-46e6-8443-91fa11a4ee58" }, error: null }) }),
    } : {}),
    ...(table === "tasks" ? { insert: mocks.taskInsert } : {}),
  }));
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
}

describe("deal engagement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.activityInsert.mockResolvedValue({ error: null });
    mocks.noteInsert.mockResolvedValue({ error: null });
    mocks.taskInsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: [{ user_id: userId }], error: null });
    setupDeal();
  });

  it("logs a validated manual activity scoped to the current workspace and deal", async () => {
    const form = dealForm();
    form.set("type", "meeting"); form.set("subject", "Pricing review"); form.set("body", "Reviewed terms.");
    form.set("occurredAt", "2026-04-03T12:00:00.000Z"); form.set("timezoneOffset", "");

    await expect(logDealActivityAction({}, form)).resolves.toEqual({ ok: true, message: "Activity logged." });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: workspaceId, created_by: userId, owner_id: userId,
      related_entity_type: "deal", related_entity_id: dealId, activity_type: "meeting",
      subject: "Pricing review", is_system_event: false,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it("adds a note for a deal owned by the current member", async () => {
    const form = dealForm(); form.set("body", "Customer needs implementation in June.");

    await expect(addDealNoteAction({}, form)).resolves.toEqual({ ok: true, message: "Note added." });
    expect(mocks.noteInsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: workspaceId, body: "Customer needs implementation in June.", created_by: userId,
      related_entity_type: "deal", related_entity_id: dealId,
    }));
  });

  it("toggles a note pin only after finding the note under its owned deal", async () => {
    const form = dealForm(); form.set("noteId", "e75c8819-b731-46e6-8443-91fa11a4ee58");

    await expect(toggleDealNotePinAction({}, form)).resolves.toEqual({ ok: true, message: "Note pinned." });
    expect(mocks.noteSelect).toHaveBeenCalledWith("id, is_pinned, created_by");
    expect(mocks.noteUpdate).toHaveBeenCalledWith({ is_pinned: true });
    expect(mocks.noteUpdateEq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.noteUpdateEq).toHaveBeenCalledWith("related_entity_id", dealId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it("rejects pinning a note created by someone else for a non-admin editor", async () => {
    setupDeal(userId, "open", peerId);
    const form = dealForm(); form.set("noteId", "e75c8819-b731-46e6-8443-91fa11a4ee58");

    const result = await toggleDealNotePinAction({}, form);
    expect(result).toEqual({ message: "You can update only your own notes." });
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a user with edit-all pin a note created by someone else", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    setupDeal(peerId, "open", peerId);
    const form = dealForm(); form.set("noteId", "e75c8819-b731-46e6-8443-91fa11a4ee58");

    await expect(toggleDealNotePinAction({}, form)).resolves.toEqual({ ok: true, message: "Note pinned." });
    expect(mocks.noteUpdate).toHaveBeenCalledWith({ is_pinned: true });
  });

  it("rejects malformed note IDs before querying or updating notes", async () => {
    const form = dealForm(); form.set("noteId", "not-a-uuid");

    const result = await toggleDealNotePinAction({}, form);
    expect(result.message).toBe("This note could not be identified.");
    expect(mocks.from).not.toHaveBeenCalledWith("notes");
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
  });

  it("rejects pinning notes on peer-owned deals before querying or updating notes", async () => {
    setupDeal(peerId);
    const form = dealForm(); form.set("noteId", "e75c8819-b731-46e6-8443-91fa11a4ee58");

    const result = await toggleDealNotePinAction({}, form);
    expect(result.message).toBe("You can update only deals assigned to you.");
    expect(mocks.noteSelect).not.toHaveBeenCalled();
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
  });

  it("creates a self-assigned follow-up task linked to an open deal", async () => {
    const form = dealForm();
    form.set("title", "Send proposal"); form.set("description", "Include implementation dates.");
    form.set("type", "follow_up"); form.set("priority", "high");
    form.set("dueAt", "2026-04-04T12:00:00.000Z"); form.set("timezoneOffset", "");

    await expect(createDealFollowUpTaskAction({}, form)).resolves.toEqual({ ok: true, message: "Follow-up task created." });
    expect(mocks.taskInsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: workspaceId, created_by: userId, assigned_to: userId, title: "Send proposal",
      related_entity_type: "deal", related_entity_id: dealId, status: "open", priority: "high",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/tasks");
  });

  it("rejects a member's activity on a peer-owned deal", async () => {
    setupDeal(peerId);
    const form = dealForm(); form.set("type", "call"); form.set("subject", "Unauthorized");
    form.set("occurredAt", "2026-04-03T12:00:00.000Z"); form.set("timezoneOffset", "");

    const result = await logDealActivityAction({}, form);
    expect(result.message).toBe("You can update only deals assigned to you.");
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("does not allow follow-up tasks on closed deals", async () => {
    setupDeal(userId, "won");
    const form = dealForm(); form.set("title", "Post-sale task"); form.set("type", "follow_up");
    form.set("priority", "medium"); form.set("dueAt", "2026-04-04T12:00:00.000Z"); form.set("timezoneOffset", "");

    const result = await createDealFollowUpTaskAction({}, form);
    expect(result.message).toBe("Follow-up tasks can be created only for open deals.");
    expect(mocks.taskInsert).not.toHaveBeenCalled();
  });

  it("rejects malformed deal IDs without opening a database session", async () => {
    const result = await addDealNoteAction({}, dealForm("not-a-uuid"));
    expect(result.message).toBe("This deal could not be identified.");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
