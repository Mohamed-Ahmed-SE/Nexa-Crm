import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(), rpc: vi.fn(),
  leadUpdate: vi.fn(), activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { convertLeadAction, updateLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const contactId = "64a833d2-008e-4b8a-8617-123ba951a178";
const oldOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const newOwnerId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";
let activities: Record<string, unknown>[];

function leadForm({ status = "contacted", ownerId = oldOwnerId }: { status?: string; ownerId?: string } = {}) {
  const form = new FormData();
  form.set("id", leadId); form.set("fullName", "Jordan Lee"); form.set("companyName", "Acme");
  form.set("email", ""); form.set("phone", ""); form.set("jobTitle", ""); form.set("sourceId", "");
  form.set("status", status); form.set("ownerId", ownerId); form.set("estimatedValue", "1250"); form.set("notesSummary", "");
  return form;
}

function conversionForm() {
  const form = new FormData();
  form.set("id", leadId); form.set("createContact", "on"); form.set("contactFirstName", "Jordan");
  form.set("contactLastName", "Lee"); form.set("createCompany", ""); form.set("companyName", "");
  form.set("createDeal", ""); form.set("dealTitle", ""); form.set("pipelineId", ""); form.set("stageId", "");
  form.set("dealOwnerId", ""); form.set("dealValue", ""); form.set("closeDate", "");
  return form;
}

function setupActions({
  currentStatus = "qualified", currentOwnerId = oldOwnerId, updateError = null,
  activityErrorType = null, conversionError = null,
}: {
  currentStatus?: string; currentOwnerId?: string; updateError?: Error | null;
  activityErrorType?: string | null; conversionError?: Error | null;
} = {}) {
  const currentQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: {
      id: leadId, full_name: "Jordan Lee", company_name: "Acme", source_id: null,
      status: currentStatus, owner_id: currentOwnerId, currency: "USD",
    }, error: null }),
  };
  const updateQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: mocks.leadUpdate.mockResolvedValue({ data: updateError ? null : { id: leadId }, error: updateError }),
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
    if (table === "leads") return {
      select: vi.fn().mockReturnValue(currentQuery), update: vi.fn().mockReturnValue(updateQuery),
    };
    if (table === "profiles") return { select: vi.fn().mockReturnValue(profileQuery) };
    return { insert: mocks.activityInsert };
  });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "convert_lead") return {
      data: { contactId, companyId: null, dealId: null }, error: conversionError,
    };
    return { data: [{ user_id: oldOwnerId }, { user_id: newOwnerId }], error: null };
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
}

describe("lead status-change audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks(); activities = []; setupActions();
  });

  it("records old and new lead statuses after a successful update", async () => {
    const response = await updateLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead updated." });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activity_type: "status_changed", subject: "Lead status changed",
      body: "Lead status changed from Qualified to Contacted.", created_by: userId, owner_id: userId,
      related_entity_type: "lead", related_entity_id: leadId,
      metadata: { old_status: "qualified", new_status: "contacted" }, is_system_event: false,
    });
  });

  it("does not log an event when lead status is unchanged", async () => {
    const response = await updateLeadAction({}, leadForm({ status: "qualified" }));

    expect(response).toEqual({ ok: true, message: "Lead updated." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("does not log an event when the lead update fails", async () => {
    setupActions({ updateError: new Error("update failed") });

    const response = await updateLeadAction({}, leadForm());

    expect(response).toMatchObject({ message: "Lead could not be updated. Check your access and try again." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps a successful update and warns when status activity logging fails", async () => {
    setupActions({ activityErrorType: "status_changed" });

    const response = await updateLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead updated, but an activity could not be recorded." });
    expect(mocks.leadUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
  });

  it("attempts owner and status events independently when both fields change", async () => {
    setupActions({ activityErrorType: "owner_changed" });

    const response = await updateLeadAction({}, leadForm({ ownerId: newOwnerId }));

    expect(response).toEqual({ ok: true, message: "Lead updated, but an activity could not be recorded." });
    expect(mocks.activityInsert).toHaveBeenCalledTimes(2);
    expect(mocks.activityInsert.mock.calls.map(([activity]) => activity.activity_type)).toEqual(["owner_changed", "status_changed"]);
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ activity_type: "status_changed", metadata: { old_status: "qualified", new_status: "contacted" } });
  });

  it("records the transition to converted after conversion succeeds", async () => {
    const response = await convertLeadAction(conversionForm());

    expect(response).toEqual({ ok: true, conversionCompleted: true, message: "Lead converted.", contactId, companyId: null, dealId: null });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activity_type: "status_changed", subject: "Lead status changed",
      body: "Lead status changed from Qualified to Converted.", created_by: userId, owner_id: userId,
      related_entity_type: "lead", related_entity_id: leadId,
      metadata: { old_status: "qualified", new_status: "converted" }, is_system_event: false,
    });
  });

  it("does not log a status event when lead conversion fails", async () => {
    setupActions({ conversionError: new Error("conversion failed") });

    const response = await convertLeadAction(conversionForm());

    expect(response).toMatchObject({ message: "Lead conversion failed. No records were created; review the options and try again." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });
});
