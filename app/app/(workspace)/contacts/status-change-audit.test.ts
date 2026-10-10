import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  contactUpdate: vi.fn(), activityInsert: vi.fn(),
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
let activities: Record<string, unknown>[];

function contactForm({ status = "customer", ownerId = oldOwnerId }: { status?: string; ownerId?: string } = {}) {
  const form = new FormData();
  form.set("id", contactId); form.set("firstName", "Taylor"); form.set("lastName", "Nguyen");
  form.set("email", "taylor@example.test"); form.set("phone", ""); form.set("jobTitle", "Director");
  form.set("companyId", ""); form.set("ownerId", ownerId); form.set("lifecycleStatus", status); form.set("linkedinUrl", "");
  return form;
}

function setupUpdate({
  currentStatus = "active", currentOwnerId = oldOwnerId, updateError = null, activityErrorType = null,
}: { currentStatus?: string; currentOwnerId?: string; updateError?: Error | null; activityErrorType?: string | null } = {}) {
  const currentQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: {
      id: contactId, company_id: null, owner_id: currentOwnerId, lifecycle_status: currentStatus,
    }, error: null }),
  };
  const updateQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: mocks.contactUpdate.mockResolvedValue({ data: updateError ? null : { id: contactId }, error: updateError }),
  };
  let profileId = "";
  const profileQuery = {
    eq: vi.fn((_column: string, value: string) => { profileId = value; return profileQuery; }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: { full_name: profileId === oldOwnerId ? "Alex Owner" : "Sam Owner" }, error: null,
    })),
  };
  mocks.activityInsert.mockImplementation(async (activity: Record<string, unknown>) => {
    if (activity.activity_type !== activityErrorType) activities.push(activity);
    return { error: activity.activity_type === activityErrorType ? new Error("activity insert failed") : null };
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === "contacts") return {
      select: vi.fn().mockReturnValue(currentQuery), update: vi.fn().mockReturnValue(updateQuery),
    };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileQuery) };
    return { insert: mocks.activityInsert };
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: vi.fn().mockResolvedValue({ data: [{ user_id: newOwnerId }], error: null }) });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
}

describe("contact status-change audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks(); activities = []; setupUpdate();
  });

  it("records old and new lifecycle statuses after a successful update", async () => {
    const response = await updateContactAction({}, contactForm());

    expect(response).toEqual({ ok: true, message: "Contact updated." });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activity_type: "status_changed", subject: "Contact status changed",
      body: "Contact lifecycle status changed from Active to Customer.", created_by: userId, owner_id: userId,
      related_entity_type: "contact", related_entity_id: contactId,
      metadata: { old_status: "active", new_status: "customer" }, is_system_event: false,
    });
  });

  it("uses the displayed lifecycle label for former customer statuses", async () => {
    setupUpdate({ currentStatus: "former_customer" });

    await updateContactAction({}, contactForm({ status: "inactive" }));

    expect(activities[0]).toMatchObject({
      body: "Contact lifecycle status changed from Former customer to Inactive.",
      metadata: { old_status: "former_customer", new_status: "inactive" },
    });
  });

  it("does not log an event when lifecycle status is unchanged", async () => {
    const response = await updateContactAction({}, contactForm({ status: "active" }));

    expect(response).toEqual({ ok: true, message: "Contact updated." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("does not log an event when the contact update fails", async () => {
    setupUpdate({ updateError: new Error("update failed") });

    const response = await updateContactAction({}, contactForm());

    expect(response).toMatchObject({ message: "Contact could not be updated. Check your access and try again." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps a successful update and warns when status activity logging fails", async () => {
    setupUpdate({ activityErrorType: "status_changed" });

    const response = await updateContactAction({}, contactForm());

    expect(response).toEqual({ ok: true, message: "Contact updated, but its status-change activity could not be recorded." });
    expect(mocks.contactUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
  });

  it("attempts owner and status events independently when both fields change", async () => {
    setupUpdate({ activityErrorType: "owner_changed" });

    const response = await updateContactAction({}, contactForm({ ownerId: newOwnerId }));

    expect(response).toEqual({ ok: true, message: "Contact updated, but its owner-change activity could not be recorded." });
    expect(mocks.activityInsert).toHaveBeenCalledTimes(2);
    expect(mocks.activityInsert.mock.calls.map(([activity]) => activity.activity_type)).toEqual(["owner_changed", "status_changed"]);
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ activity_type: "status_changed", metadata: { old_status: "active", new_status: "customer" } });
  });
});
