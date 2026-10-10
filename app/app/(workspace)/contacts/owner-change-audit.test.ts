import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  contactUpdate: vi.fn(),
  activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { updateContactAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const contactId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const oldOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const newOwnerId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function contactForm(ownerId: string) {
  const form = new FormData();
  form.set("id", contactId);
  form.set("firstName", "Taylor");
  form.set("lastName", "Nguyen");
  form.set("email", "taylor@example.test");
  form.set("phone", "");
  form.set("jobTitle", "Director");
  form.set("companyId", "");
  form.set("ownerId", ownerId);
  form.set("lifecycleStatus", "active");
  form.set("linkedinUrl", "");
  return form;
}

function setupOwnerChange({ ownerId = oldOwnerId, activityError = false } = {}) {
  const contactRead = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: contactId, company_id: null, owner_id: ownerId, lifecycle_status: "active" }, error: null }),
  };
  const contactUpdate = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: mocks.contactUpdate.mockResolvedValue({ data: { id: contactId }, error: null }),
  };
  let profileId = "";
  const profileRead = {
    eq: vi.fn((_column: string, value: string) => {
      profileId = value;
      return profileRead;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: { full_name: profileId === oldOwnerId ? "Alex Owner" : "Sam Owner" }, error: null,
    })),
  };
  mocks.activityInsert.mockResolvedValue({ error: activityError ? { message: "insert failed" } : null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "contacts") return {
      select: vi.fn().mockReturnValue(contactRead),
      update: vi.fn().mockReturnValue(contactUpdate),
    };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileRead) };
    return { insert: mocks.activityInsert };
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    from: mocks.from,
    rpc: vi.fn().mockResolvedValue({ data: [{ user_id: newOwnerId }], error: null }),
  });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
}

describe("contact owner-change audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupOwnerChange();
  });

  it("records a changed contact owner with readable labels and audit identifiers", async () => {
    const response = await updateContactAction({}, contactForm(newOwnerId));

    expect(response).toEqual({ ok: true, message: "Contact updated." });
    expect(mocks.contactUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      activity_type: "owner_changed",
      subject: "Contact owner changed",
      body: "Contact owner changed from Alex Owner to Sam Owner.",
      created_by: userId,
      owner_id: userId,
      related_entity_type: "contact",
      related_entity_id: contactId,
      metadata: { old_owner_id: oldOwnerId, new_owner_id: newOwnerId },
      is_system_event: false,
    }));
    expect(mocks.activityInsert.mock.calls[0][0].body).not.toContain(oldOwnerId);
    expect(mocks.activityInsert.mock.calls[0][0].body).not.toContain(newOwnerId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/contacts");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/contacts/${contactId}`);
  });

  it("does not record an audit event when the owner is unchanged", async () => {
    const response = await updateContactAction({}, contactForm(oldOwnerId));

    expect(response).toEqual({ ok: true, message: "Contact updated." });
    expect(mocks.contactUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps the contact update successful and warns when activity insertion returns an error", async () => {
    setupOwnerChange({ activityError: true });

    const response = await updateContactAction({}, contactForm(newOwnerId));

    expect(response).toEqual({ ok: true, message: "Contact updated, but its owner-change activity could not be recorded." });
    expect(mocks.contactUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/contacts");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/contacts/${contactId}`);
  });
});
