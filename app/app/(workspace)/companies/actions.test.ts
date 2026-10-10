import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyDuplicateCandidate } from "@/lib/companies/duplicates";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  activityInsert: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createCompanyAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const match: CompanyDuplicateCandidate = { id: "company-1", name: "Acme Group", website: "https://www.acme.example" };

function companyForm(confirmDuplicate = false) {
  const form = new FormData();
  form.set("name", "ACME group");
  form.set("website", "");
  for (const key of ["industry", "employeeSize", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "description", "ownerId"]) form.set(key, "");
  if (confirmDuplicate) form.set("confirmDuplicate", "true");
  return form;
}

function setupDuplicateLookup(candidates: CompanyDuplicateCandidate[] = [match]) {
  const query = {
    eq: mocks.eq.mockReturnThis(),
    is: mocks.is.mockReturnThis(),
    then: (resolve: (response: { data: CompanyDuplicateCandidate[]; error: null }) => unknown) => Promise.resolve({ data: candidates, error: null }).then(resolve),
  };
  const insertQuery = {
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "company-created" }, error: null }),
  };
  const companyTable = { select: mocks.select.mockReturnValue(query), insert: mocks.insert.mockReturnValue(insertQuery) };
  const activityTable = { insert: mocks.activityInsert.mockResolvedValue({ error: null }) };
  mocks.from.mockImplementation((table: string) => table === "companies" ? companyTable : activityTable);
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
}

describe("create company duplicate warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.rpc.mockResolvedValue({ data: [{ user_id: userId }], error: null });
    mocks.insert.mockResolvedValue({ error: null });
    setupDuplicateLookup();
  });

  it("returns active workspace matches without inserting until explicitly confirmed", async () => {
    const response = await createCompanyAction({}, companyForm());

    expect(response).toEqual({ duplicateMatches: [match] });
    expect(mocks.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates the company with its authorized owner after explicit confirmation", async () => {
    const response = await createCompanyAction({}, companyForm(true));

    expect(response).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      created_by: userId,
      name: "ACME group",
      website: null,
      industry: null,
      employee_size: null,
      phone: null,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      description: null,
      owner_id: userId,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/companies");
  });
});
