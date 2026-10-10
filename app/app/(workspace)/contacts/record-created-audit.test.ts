import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDuplicateCandidate } from "@/lib/contacts/duplicates";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), createSupabaseServerClient: vi.fn(), revalidatePath: vi.fn(),
  from: vi.fn(), contactInsert: vi.fn(), activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createContactAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const contactId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const duplicate: ContactDuplicateCandidate = {
  first_name: "Taylor", last_name: "Nguyen", email: "taylor@example.test", phone: null, companies: null,
};
let activities: Record<string, unknown>[];

function contactForm(email = "", confirmDuplicate = false) {
  const form = new FormData();
  form.set("firstName", "Taylor"); form.set("lastName", "Nguyen"); form.set("email", email); form.set("phone", "");
  form.set("jobTitle", ""); form.set("companyId", ""); form.set("ownerId", "");
  form.set("lifecycleStatus", "active"); form.set("linkedinUrl", "");
  if (confirmDuplicate) form.set("confirmDuplicate", "true");
  return form;
}

function setupCreation({ candidates = [], created = { id: contactId }, createError = null, activityError = null }: {
  candidates?: ContactDuplicateCandidate[]; created?: { id: string } | null; createError?: Error | null; activityError?: Error | null;
} = {}) {
  const duplicateQuery = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    then: (resolve: (response: unknown) => unknown) => Promise.resolve({ data: candidates, error: null }).then(resolve),
  };
  const insertQuery = { select: vi.fn().mockReturnThis(), maybeSingle: mocks.contactInsert.mockResolvedValue({ data: created, error: createError }) };
  const contactTable = { select: vi.fn().mockReturnValue(duplicateQuery), insert: vi.fn().mockReturnValue(insertQuery) };
  const activityTable = { insert: mocks.activityInsert.mockImplementation(async (activity: Record<string, unknown>) => {
    if (activityError) return { error: activityError };
    activities.push(activity);
    return { error: null };
  }) };
  mocks.from.mockImplementation((table: string) => table === "contacts" ? contactTable : activityTable);
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("contact record-created activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activities = [];
    setupCreation();
  });

  it("persists an event for the created contact after creation succeeds", async () => {
    const response = await createContactAction({}, contactForm());

    expect(response).toEqual({ ok: true, message: "Contact added." });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      workspace_id: workspaceId, activity_type: "record_created", subject: "Contact created",
      created_by: userId, owner_id: userId, related_entity_type: "contact", related_entity_id: contactId,
      is_system_event: false,
    });
  });

  it("does not create an event when duplicate confirmation is required", async () => {
    setupCreation({ candidates: [duplicate] });

    const response = await createContactAction({}, contactForm("taylor@example.test"));

    expect(response).toEqual({ duplicateMatches: [{ name: "Taylor Nguyen", companyName: null }] });
    expect(activities).toHaveLength(0);
  });

  it.each([
    ["create error", null, new Error("insert failed")],
    ["missing returned row ID", null, null],
  ])("does not create an event after a %s", async (_scenario, created, createError) => {
    setupCreation({ created, createError });

    const response = await createContactAction({}, contactForm());

    expect(response).toMatchObject({ message: "Contact could not be created. Check your access and try again." });
    expect(activities).toHaveLength(0);
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps contact creation successful with a warning if event logging fails", async () => {
    setupCreation({ activityError: new Error("activity insert failed") });

    const response = await createContactAction({}, contactForm());

    expect(response).toEqual({ ok: true, message: "Contact added, but its activity could not be recorded." });
    expect(activities).toHaveLength(0);
  });
});
