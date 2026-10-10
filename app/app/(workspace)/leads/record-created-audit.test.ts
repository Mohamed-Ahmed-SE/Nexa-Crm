import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadDuplicateCandidate } from "@/lib/leads/duplicates";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  workspaceMaybeSingle: vi.fn(), leadInsert: vi.fn(), activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const duplicate: LeadDuplicateCandidate = {
  id: "duplicate-id", full_name: "Jordan Lee", email: "jordan@example.test", phone: null,
};
let activities: Record<string, unknown>[];

function leadForm(email = "", confirmDuplicate = false) {
  const form = new FormData();
  form.set("fullName", "Jordan Lee"); form.set("companyName", ""); form.set("email", email); form.set("phone", "");
  form.set("jobTitle", ""); form.set("sourceId", ""); form.set("status", "new"); form.set("ownerId", "");
  form.set("estimatedValue", "0"); form.set("notesSummary", "");
  if (confirmDuplicate) form.set("confirmDuplicate", "true");
  return form;
}

function setupCreation({ candidates = [], created = { id: leadId }, createError = null, activityError = null }: {
  candidates?: LeadDuplicateCandidate[]; created?: { id: string } | null; createError?: Error | null; activityError?: Error | null;
} = {}) {
  const duplicateQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    then: (resolve: (response: unknown) => unknown) => Promise.resolve({ data: candidates, error: null }).then(resolve),
  };
  const insertQuery = { select: vi.fn().mockReturnThis(), maybeSingle: mocks.leadInsert.mockResolvedValue({ data: created, error: createError }) };
  const leadTable = { select: vi.fn().mockReturnValue(duplicateQuery), insert: vi.fn().mockReturnValue(insertQuery) };
  const workspaceQuery = { eq: vi.fn().mockReturnThis(), maybeSingle: mocks.workspaceMaybeSingle.mockResolvedValue({ data: { default_currency: "USD" }, error: null }) };
  const workspaceTable = { select: vi.fn().mockReturnValue(workspaceQuery) };
  const activityTable = { insert: mocks.activityInsert.mockImplementation(async (activity: Record<string, unknown>) => {
    if (activityError) return { error: activityError };
    activities.push(activity);
    return { error: null };
  }) };
  mocks.from.mockImplementation((table: string) => {
    if (table === "leads") return leadTable;
    if (table === "workspaces") return workspaceTable;
    return activityTable;
  });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("lead record-created activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activities = [];
    setupCreation();
  });

  it("persists an event for the created lead after creation succeeds", async () => {
    const response = await createLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead added." });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      workspace_id: workspaceId, activity_type: "record_created", subject: "Lead created",
      created_by: userId, owner_id: userId, related_entity_type: "lead", related_entity_id: leadId,
      is_system_event: false,
    });
  });

  it("does not create an event when duplicate confirmation is required", async () => {
    setupCreation({ candidates: [duplicate] });

    const response = await createLeadAction({}, leadForm("jordan@example.test"));

    expect(response).toEqual({ duplicateMatches: [{ id: duplicate.id, full_name: duplicate.full_name, email: duplicate.email, phone: duplicate.phone }] });
    expect(activities).toHaveLength(0);
  });

  it.each([
    ["create error", null, new Error("insert failed")],
    ["missing returned row ID", null, null],
  ])("does not create an event after a %s", async (_scenario, created, createError) => {
    setupCreation({ created, createError });

    const response = await createLeadAction({}, leadForm());

    expect(response).toMatchObject({ message: "Lead could not be created. Check your access and try again." });
    expect(activities).toHaveLength(0);
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps lead creation successful with a warning if event logging fails", async () => {
    setupCreation({ activityError: new Error("activity insert failed") });

    const response = await createLeadAction({}, leadForm());

    expect(response).toEqual({ ok: true, message: "Lead added, but its activity could not be recorded." });
    expect(activities).toHaveLength(0);
  });
});
