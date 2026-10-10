import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  activityInsert: vi.fn(),
  leadUpdate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { updateLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const oldOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const newOwnerId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function leadForm(ownerId: string | null = newOwnerId) {
  const form = new FormData();
  form.set("id", leadId);
  form.set("fullName", "Jordan Lee");
  form.set("companyName", "Acme");
  form.set("email", "");
  form.set("phone", "");
  form.set("jobTitle", "");
  form.set("sourceId", "");
  form.set("status", "qualified");
  form.set("ownerId", ownerId ?? "");
  form.set("estimatedValue", "1250");
  form.set("notesSummary", "");
  return form;
}

function setupOwnerChange({ activityError = null, oldOwnerLabel = "Alex Owner" }: {
  activityError?: Error | null;
  oldOwnerLabel?: string;
} = {}) {
  let updateReturned = false;
  let profileOwnerId = "";
  const leadRead = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: leadId,
        full_name: "Jordan Lee",
        company_name: "Acme",
        source_id: null,
        status: "qualified",
        owner_id: oldOwnerId,
        currency: "USD",
      },
      error: null,
    }),
  };
  const leadSave = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: mocks.leadUpdate.mockImplementation(async () => {
      updateReturned = true;
      return { data: { id: leadId }, error: null };
    }),
  };
  const profileRead = {
    eq: vi.fn((_column: string, value: string) => {
      profileOwnerId = value;
      return profileRead;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: { full_name: profileOwnerId === oldOwnerId ? oldOwnerLabel : "Sam Owner" },
      error: null,
    })),
  };
  mocks.activityInsert.mockResolvedValue({ error: activityError });
  mocks.from.mockImplementation((table: string) => {
    if (table === "leads") return {
      select: vi.fn().mockReturnValue(leadRead),
      update: vi.fn().mockReturnValue(leadSave),
    };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileRead) };
    return { insert: mocks.activityInsert };
  });
  mocks.rpc.mockResolvedValue({ data: [{ user_id: oldOwnerId }, { user_id: newOwnerId }], error: null });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
  return { wasLeadUpdated: () => updateReturned };
}

describe("lead owner-change audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOwnerChange();
  });

  it("records the lead owner change with readable labels and audit identifiers", async () => {
    const response = await updateLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead updated." });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      activity_type: "owner_changed",
      subject: "Lead owner changed",
      body: "Lead owner changed from Alex Owner to Sam Owner.",
      created_by: userId,
      owner_id: userId,
      related_entity_type: "lead",
      related_entity_id: leadId,
      metadata: { old_owner_id: oldOwnerId, new_owner_id: newOwnerId },
      is_system_event: false,
    }));
    const body = mocks.activityInsert.mock.calls[0][0].body as string;
    expect(body).not.toContain(oldOwnerId);
    expect(body).not.toContain(newOwnerId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/leads/${leadId}`);
  });

  it("replaces a UUID-shaped profile name with the generic member label", async () => {
    setupOwnerChange({ oldOwnerLabel: oldOwnerId });

    const response = await updateLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead updated." });
    const body = mocks.activityInsert.mock.calls[0][0].body as string;
    expect(body).toBe("Lead owner changed from Workspace member to Sam Owner.");
    expect(body).not.toContain(oldOwnerId);
    expect(body).not.toContain(newOwnerId);
  });

  it("does not record an event when the lead owner is unchanged", async () => {
    const response = await updateLeadAction({}, leadForm(oldOwnerId));

    expect(response).toEqual({ ok: true, message: "Lead updated." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps the lead update successful and warns when activity insertion fails", async () => {
    const persistence = setupOwnerChange({ activityError: new Error("activity insert failed") });

    const response = await updateLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead updated, but an activity could not be recorded." });
    expect(persistence.wasLeadUpdated()).toBe(true);
    expect(mocks.leadUpdate).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/leads/${leadId}`);
  });
});
