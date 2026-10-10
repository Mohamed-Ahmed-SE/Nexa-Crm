import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  activityInsert: vi.fn(),
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

function setupUpdate({ role = "member", amount = 12000, ownerId = userId, activityFailure = false } = {}) {
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
  mocks.from.mockImplementation((table: string) => {
    if (table === "deals") return { select: vi.fn().mockReturnValue(dealRead), update: vi.fn().mockReturnValue(dealUpdate) };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileRead) };
    return activityTable;
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    from: mocks.from,
    rpc: vi.fn().mockResolvedValue({ data: [{ user_id: newOwnerId }], error: null }),
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

  it("does not emit audit events when owner and value are unchanged", async () => {
    const response = await updateDealAction(dealForm());

    expect(response).toEqual({ ok: true, message: "Deal updated." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
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
