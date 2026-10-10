import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  companyUpdate: vi.fn(),
  activityInsert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { updateCompanyAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const companyId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const oldOwnerId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const newOwnerId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function companyForm(ownerId: string) {
  const form = new FormData();
  form.set("id", companyId);
  form.set("name", "Acme Group");
  form.set("website", "");
  for (const key of ["industry", "employeeSize", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "description"]) form.set(key, "");
  form.set("ownerId", ownerId);
  return form;
}

function setupUpdate({ ownerId = oldOwnerId, activityError = false, newOwnerLabel = "Sam Owner" } = {}) {
  let requestedOwnerId: string | null = null;
  const companyRead = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: companyId, owner_id: ownerId }, error: null }),
  };
  const companyWrite = {
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (response: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  const profileRead = {
    eq: vi.fn((_column: string, profileId: string) => {
      requestedOwnerId = profileId;
      return profileRead;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: { full_name: requestedOwnerId === oldOwnerId ? "Alex Owner" : newOwnerLabel }, error: null,
    })),
  };
  const profiles = { select: vi.fn().mockReturnValue(profileRead) };
  mocks.companyUpdate.mockImplementation((fields: { owner_id: string | null }) => {
    requestedOwnerId = fields.owner_id;
    return companyWrite;
  });
  mocks.activityInsert.mockResolvedValue({ error: activityError ? { message: "activity insert failed" } : null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "companies") return {
      select: vi.fn().mockReturnValue(companyRead), update: mocks.companyUpdate,
    };
    if (table === "profiles") return profiles;
    return { insert: mocks.activityInsert };
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    from: mocks.from,
    rpc: vi.fn().mockResolvedValue({ data: [{ user_id: oldOwnerId }, { user_id: newOwnerId }], error: null }),
  });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
}

describe("company owner-change audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUpdate();
  });

  it("records a readable owner-change activity with audit identifiers", async () => {
    const response = await updateCompanyAction({}, companyForm(newOwnerId));

    expect(response).toEqual({ ok: true });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      activity_type: "owner_changed",
      subject: "Company owner changed",
      body: "Company owner changed from Alex Owner to Sam Owner.",
      created_by: userId,
      owner_id: userId,
      related_entity_type: "company",
      related_entity_id: companyId,
      metadata: { old_owner_id: oldOwnerId, new_owner_id: newOwnerId },
      is_system_event: false,
    }));
    const body = mocks.activityInsert.mock.calls[0][0].body as string;
    expect(body).not.toContain(oldOwnerId);
    expect(body).not.toContain(newOwnerId);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/app/companies", `/app/companies/${companyId}`,
    ]);
  });

  it("uses a generic label when a profile name is a UUID", async () => {
    setupUpdate({ newOwnerLabel: newOwnerId });

    await updateCompanyAction({}, companyForm(newOwnerId));

    const body = mocks.activityInsert.mock.calls[0][0].body as string;
    expect(body).toBe("Company owner changed from Alex Owner to Workspace member.");
    expect(body).not.toContain(oldOwnerId);
    expect(body).not.toContain(newOwnerId);
  });

  it("does not write an activity when the owner remains unchanged", async () => {
    const response = await updateCompanyAction({}, companyForm(oldOwnerId));

    expect(response).toEqual({ ok: true });
    expect(mocks.companyUpdate).toHaveBeenCalledOnce();
    expect(mocks.activityInsert).not.toHaveBeenCalled();
  });

  it("keeps the company update successful and warns when activity insertion fails", async () => {
    setupUpdate({ activityError: true });

    const response = await updateCompanyAction({}, companyForm(newOwnerId));

    expect(response).toEqual({
      ok: true,
      message: "Company updated, but its owner-change activity could not be recorded.",
    });
    expect(mocks.companyUpdate).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/app/companies", `/app/companies/${companyId}`,
    ]);
  });
});
