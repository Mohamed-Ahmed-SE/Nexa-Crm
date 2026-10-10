import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadDuplicateCandidate } from "@/lib/leads/duplicates";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  leadSelect: vi.fn(),
  leadEq: vi.fn(),
  leadIs: vi.fn(),
  leadInsert: vi.fn(),
  workspaceSelect: vi.fn(),
  workspaceEq: vi.fn(),
  workspaceMaybeSingle: vi.fn(),
  insertSelect: vi.fn(),
  insertMaybeSingle: vi.fn(),
  activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const match: LeadDuplicateCandidate = {
  id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084",
  full_name: "Jordan Lee",
  email: "jordan@example.test",
  phone: "+1 (415) 555-0100",
};

function leadForm(confirmDuplicate = false) {
  const form = new FormData();
  form.set("fullName", "Jordan Lee Jr.");
  form.set("companyName", "");
  form.set("email", " JORDAN@example.test ");
  form.set("phone", "+1 415-555-0100");
  form.set("jobTitle", "");
  form.set("sourceId", "");
  form.set("status", "new");
  form.set("ownerId", "");
  form.set("estimatedValue", "0");
  form.set("notesSummary", "");
  if (confirmDuplicate) form.set("confirmDuplicate", "true");
  return form;
}

function setupDuplicateLookup(candidates: LeadDuplicateCandidate[] = [match], error: Error | null = null) {
  const leadQuery = {
    select: mocks.leadSelect.mockReturnThis(),
    eq: mocks.leadEq.mockReturnThis(),
    is: mocks.leadIs.mockReturnThis(),
    then: (resolve: (result: { data: LeadDuplicateCandidate[] | null; error: Error | null }) => unknown) =>
      Promise.resolve({ data: error ? null : candidates, error }).then(resolve),
  };
  const insertQuery = {
    select: mocks.insertSelect.mockReturnThis(),
    maybeSingle: mocks.insertMaybeSingle.mockResolvedValue({ data: { id: match.id }, error: null }),
  };
  const leadTable = {
    select: mocks.leadSelect.mockReturnValue(leadQuery),
    insert: mocks.leadInsert.mockReturnValue(insertQuery),
  };
  const workspaceQuery = {
    eq: mocks.workspaceEq.mockReturnThis(),
    maybeSingle: mocks.workspaceMaybeSingle.mockResolvedValue({ data: { default_currency: "USD" }, error: null }),
  };
  const workspaceTable = { select: mocks.workspaceSelect.mockReturnValue(workspaceQuery) };
  const activityTable = { insert: mocks.activityInsert.mockResolvedValue({ error: null }) };
  mocks.from.mockImplementation((table: string) => {
    if (table === "leads") return leadTable;
    if (table === "workspaces") return workspaceTable;
    return activityTable;
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("create lead duplicate warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupDuplicateLookup();
  });

  it("returns active workspace matches before saving a lead", async () => {
    const response = await createLeadAction({}, leadForm());

    expect(response).toEqual({ duplicateMatches: [match] });
    expect(mocks.leadEq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.leadIs).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.leadInsert).not.toHaveBeenCalled();
  });

  it("saves the lead after explicit confirmation", async () => {
    const response = await createLeadAction({}, leadForm(true));

    expect(response).toEqual({ ok: true, message: "Lead added." });
    expect(mocks.leadInsert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      created_by: userId,
      currency: "USD",
      full_name: "Jordan Lee Jr.",
      company_name: null,
      email: "JORDAN@example.test",
      phone: "+1 415-555-0100",
      job_title: null,
      source_id: null,
      status: "new",
      owner_id: userId,
      estimated_value: 0,
      notes_summary: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
  });

  it("continues creation when duplicate lookup fails", async () => {
    setupDuplicateLookup([], new Error("lookup unavailable"));

    const response = await createLeadAction({}, leadForm());

    expect(response).toMatchObject({ ok: true, message: "Lead added." });
    expect(mocks.leadInsert).toHaveBeenCalledOnce();
  });
});
