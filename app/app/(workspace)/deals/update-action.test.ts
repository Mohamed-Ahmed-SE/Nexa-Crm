import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  activityInsert: vi.fn(),
  dealUpdate: vi.fn(),
  entityInsert: vi.fn(),
  entityInsertResult: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { updateDealAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const oldOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const newOwnerId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";
const tagId = "c2155412-d8a0-4792-b2bc-f6064b2798f4";

function dealForm({ amount = "12000", ownerId = userId } = {}) {
  const form = new FormData();
  form.set("id", dealId);
  form.set("title", "Renewal opportunity");
  form.set("companyId", "");
  form.set("contactId", "");
  form.set("amount", amount);
  form.set("expectedCloseDate", "");
  form.set("ownerId", ownerId);
  form.set("priority", "medium");
  form.set("description", "");
  form.set("pipelineId", "5a4302eb-742b-49cb-9f0d-bfc96e9474c3");
  return form;
}

function setupUpdate({ role = "member", amount = 12000, ownerId = userId, activityFailure = false, activeOwnerIds = [newOwnerId] } = {}) {
  const dealRead = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: dealId, status: "open", owner_id: ownerId, amount, currency: "USD" },
      error: null,
    }),
  };
  const dealUpdate = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: dealId }, error: null }),
  };
  let requestedOwnerId = "";
  const profileRead = {
    eq: vi.fn((_column: string, value: string) => {
      requestedOwnerId = value;
      return profileRead;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: { full_name: requestedOwnerId === oldOwnerId ? "Alex Owner" : "Sam Owner" },
      error: null,
    })),
  };
  const activityTable = {
    insert: mocks.activityInsert.mockImplementation(() => {
      if (activityFailure) throw new Error("activity insert failed");
      return Promise.resolve({ error: null });
    }),
  };
  const tagQuery = { eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [{ id: tagId }], error: null }).then(resolve) };
  const tagsTable = { select: vi.fn().mockReturnValue(tagQuery) };
  const entityRead = { eq: vi.fn().mockReturnThis(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  mocks.entityInsertResult.mockResolvedValue({ data: [{ tag_id: tagId }], error: null });
  const entityTable = { select: vi.fn().mockReturnValue(entityRead), insert: (rows: unknown[]) => { mocks.entityInsert(rows); return { select: vi.fn().mockImplementation(() => mocks.entityInsertResult()) }; } };
  mocks.from.mockImplementation((table: string) => {
    if (table === "deals") return { select: vi.fn().mockReturnValue(dealRead), update: mocks.dealUpdate };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileRead) };
    if (table === "tags") return tagsTable;
    if (table === "entity_tags") return entityTable;
    return activityTable;
  });
  mocks.dealUpdate.mockReturnValue(dealUpdate);
  mocks.createSupabaseServerClient.mockResolvedValue({
    from: mocks.from,
    rpc: vi.fn().mockResolvedValue({ data: activeOwnerIds.map((user_id: string) => ({ user_id })), error: null }),
  });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role });
}

describe("update deal audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUpdate();
  });

  it("records changed deal value with old and new amounts", async () => {
    const response = await updateDealAction(dealForm({ amount: "15000" }));

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      activity_type: "deal_value_changed",
      subject: "Deal value changed",
      body: "Deal value changed from USD 12,000 to USD 15,000.",
      created_by: userId,
      owner_id: userId,
      related_entity_type: "deal",
      related_entity_id: dealId,
      metadata: { old_amount: 12000, new_amount: 15000, currency: "USD" },
      is_system_event: false,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it("records an owner change using readable labels and audit identifiers", async () => {
    setupUpdate({ role: "manager", ownerId: oldOwnerId });
    const response = await updateDealAction(dealForm({ ownerId: newOwnerId }));

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      activity_type: "owner_changed",
      subject: "Deal owner changed",
      body: "Owner changed from Alex Owner to Sam Owner.",
      created_by: userId,
      owner_id: userId,
      metadata: { old_owner_id: oldOwnerId, new_owner_id: newOwnerId },
      is_system_event: false,
    }));
    expect(mocks.activityInsert.mock.calls[0][0].body).not.toContain(oldOwnerId);
    expect(mocks.activityInsert.mock.calls[0][0].body).not.toContain(newOwnerId);
  });

  it("keeps an inactive deal owner assigned during an unchanged edit", async () => {
    setupUpdate({ role: "manager", ownerId: oldOwnerId, activeOwnerIds: [newOwnerId] });

    const response = await updateDealAction(dealForm({ ownerId: oldOwnerId }));

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.dealUpdate).toHaveBeenCalledWith(expect.objectContaining({ owner_id: oldOwnerId }));
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("rejects changing a deal to an inactive owner", async () => {
    setupUpdate({ role: "manager", ownerId: newOwnerId, activeOwnerIds: [newOwnerId] });

    const response = await updateDealAction(dealForm({ ownerId: oldOwnerId }));

    expect(response).toEqual({ ok: false, message: "Select an active owner in this workspace." });
    expect(mocks.dealUpdate).not.toHaveBeenCalled();
  });

  it("does not emit audit events when owner and value are unchanged", async () => {
    const response = await updateDealAction(dealForm());

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("persists selected deal tags after a permitted edit", async () => {
    const form = dealForm();
    form.append("tagIds", tagId);

    const response = await updateDealAction(form);

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.entityInsert).toHaveBeenCalledWith([{ workspace_id: workspaceId, entity_type: "deal", entity_id: dealId, tag_id: tagId }]);
  });

  it("does not claim tags were saved when association persistence fails", async () => {
    mocks.entityInsertResult.mockResolvedValue({ data: null, error: new Error("tag insert failed") });
    const form = dealForm();
    form.append("tagIds", tagId);

    const response = await updateDealAction(form);

    expect(response).toEqual({ ok: false, message: "Deal details were updated, but tags could not be saved. Existing tags were retained where possible." });
    expect(mocks.dealUpdate).toHaveBeenCalledOnce();
  });

  it("keeps the deal update successful and warns when event insertion throws", async () => {
    setupUpdate({ activityFailure: true });

    const response = await updateDealAction(dealForm({ amount: "15000" }));

    expect(response).toEqual({ ok: true, message: "Deal updated, but an activity could not be recorded." });
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });
});
