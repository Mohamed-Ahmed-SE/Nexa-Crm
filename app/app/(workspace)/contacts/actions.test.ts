import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDuplicateCandidate } from "@/lib/contacts/duplicates";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createContactAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const match: ContactDuplicateCandidate = {
  first_name: "Jordan",
  last_name: "Lee",
  email: "jordan@example.test",
  phone: "(415) 555-0100",
  companies: { name: "Acme" },
};

function contactForm(confirmDuplicate = false) {
  const form = new FormData();
  form.set("firstName", "Jordan");
  form.set("lastName", "Lee Jr.");
  form.set("email", " JORDAN@example.test ");
  form.set("phone", "+1 415-555-0100");
  form.set("companyId", "");
  form.set("ownerId", "");
  form.set("lifecycleStatus", "active");
  form.set("linkedinUrl", "");
  if (confirmDuplicate) form.set("confirmDuplicate", "true");
  return form;
}

function setupDuplicateLookup() {
  const query = {
    eq: mocks.eq.mockReturnThis(),
    is: mocks.is.mockReturnThis(),
    then: (resolve: (result: { data: ContactDuplicateCandidate[]; error: null }) => unknown) => Promise.resolve({ data: [match], error: null }).then(resolve),
  };
  mocks.select.mockReturnValue(query);
  mocks.from.mockImplementation(() => ({ select: mocks.select, insert: mocks.insert }));
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("create contact duplicate warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.insert.mockResolvedValue({ error: null });
    setupDuplicateLookup();
  });

  it("returns active workspace matches before inserting until explicitly confirmed", async () => {
    const result = await createContactAction({}, contactForm());

    expect(result).toEqual({ duplicateMatches: [{ name: "Jordan Lee", companyName: "Acme" }] });
    expect(mocks.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates the contact after the user confirms proceeding despite a match", async () => {
    const result = await createContactAction({}, contactForm(true));

    expect(result).toEqual({ ok: true, message: "Contact added." });
    expect(mocks.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      created_by: userId,
      first_name: "Jordan",
      last_name: "Lee Jr.",
      email: "JORDAN@example.test",
      phone: "+1 415-555-0100",
      job_title: null,
      company_id: null,
      owner_id: userId,
      lifecycle_status: "active",
      linkedin_url: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/contacts");
  });
});
