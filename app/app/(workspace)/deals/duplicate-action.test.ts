import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  activityInsert: vi.fn(),
  dealInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { duplicateDealAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const sourceOwnerId = "3f190a91-7f54-4c1c-9e87-810dece79a36";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const newDealId = "23f745fd-609d-433f-96fc-c50f60a3ec6e";
const pipelineId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const stageId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";
const companyId = "9abac37d-9388-44f3-b88a-563b3a8c6320";
const contactId = "a91e8886-5bec-4147-8b6c-9187aa9c8951";

const sourceDeal = {
  id: dealId, pipeline_id: pipelineId, title: "Renewal opportunity", company_id: companyId,
  primary_contact_id: contactId, amount: 12000, currency: "CAD", expected_close_date: "2026-08-15",
  owner_id: userId, priority: "high", description: "Expansion plan", status: "won",
};

function setupDuplicate({
  source = sourceDeal,
  inserted = { data: { id: newDealId }, error: null },
  role = "member",
  eligibleMembers = [{ user_id: userId }],
}: {
  source?: typeof sourceDeal | null;
  inserted?: { data: { id: string } | null; error: Error | null };
  role?: string;
  eligibleMembers?: Array<{ user_id: string }>;
} = {}) {
  const query = (table: string) => {
    const queryChain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["eq", "is", "order", "limit", "select"]) queryChain[method] = vi.fn().mockReturnValue(queryChain);
    queryChain.maybeSingle = vi.fn().mockResolvedValue({
      data: table === "deals" ? source : table === "pipelines" ? { id: pipelineId } : table === "pipeline_stages" ? { id: stageId } : { id: table === "companies" ? companyId : contactId, ...(table === "contacts" ? { company_id: companyId } : {}) },
      error: null,
    });
    return queryChain;
  };
  const sourceQuery = query("deals");
  const tables = new Map<string, ReturnType<typeof query>>();
  mocks.from.mockImplementation((table: string) => {
    if (table === "activities") return { insert: mocks.activityInsert.mockResolvedValue({ error: null }) };
    if (table === "deals") return {
      select: vi.fn().mockReturnValue(sourceQuery),
      insert: vi.fn().mockImplementation((payload) => {
        mocks.dealInsert(payload);
        return { select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(inserted) }) };
      }),
    };
    if (!tables.has(table)) tables.set(table, query(table));
    return { select: vi.fn().mockReturnValue(tables.get(table)) };
  });
  mocks.rpc.mockResolvedValue({ data: eligibleMembers, error: null });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role });
  return sourceQuery;
}

function duplicateForm(id = dealId) {
  const form = new FormData();
  form.set("id", id);
  return form;
}

describe("duplicate deal action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("creates an open-stage copy of a won deal with selected source fields", async () => {
    const sourceQuery = setupDuplicate();
    const response = await duplicateDealAction(duplicateForm());

    expect(response).toEqual({ ok: true, message: "Deal duplicated." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.create");
    expect(sourceQuery.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(sourceQuery.eq).toHaveBeenCalledWith("id", dealId);
    expect(sourceQuery.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.dealInsert).toHaveBeenCalledWith({
      workspace_id: workspaceId, created_by: userId, pipeline_id: pipelineId, stage_id: stageId, currency: "CAD",
      title: "Renewal opportunity (Copy)", company_id: companyId, primary_contact_id: contactId, amount: 12000,
      expected_close_date: "2026-08-15", owner_id: userId, priority: "high", description: "Expansion plan",
    });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({ activity_type: "record_created", subject: "Deal duplicated", related_entity_id: newDealId }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${newDealId}`);
  });

  it.each([
    { scenario: "preserves an eligible source owner", eligibleMembers: [{ user_id: sourceOwnerId }], expectedOwnerId: sourceOwnerId },
    { scenario: "falls back for an ineligible source owner", eligibleMembers: [], expectedOwnerId: userId },
  ])("$scenario", async ({ eligibleMembers, expectedOwnerId }) => {
    setupDuplicate({ source: { ...sourceDeal, owner_id: sourceOwnerId }, role: "manager", eligibleMembers });

    await duplicateDealAction(duplicateForm());

    expect(mocks.dealInsert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: expectedOwnerId }));
  });

  it("does not insert when the source deal cannot be verified", async () => {
    setupDuplicate({ source: null });

    const response = await duplicateDealAction(duplicateForm());

    expect(response).toEqual({ ok: false, message: "This deal could not be verified in this workspace." });
    expect(mocks.dealInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the copy suffix within the deal title limit", async () => {
    setupDuplicate({ source: { ...sourceDeal, title: "D".repeat(200) } });

    await duplicateDealAction(duplicateForm());

    const insertedTitle = mocks.dealInsert.mock.calls[0][0].title as string;
    expect(insertedTitle).toHaveLength(200);
    expect(insertedTitle.endsWith(" (Copy)")).toBe(true);
  });

  it("does not report success when insertion returns no created deal", async () => {
    setupDuplicate({ inserted: { data: null, error: new Error("insert failed") } });

    const response = await duplicateDealAction(duplicateForm());

    expect(response).toEqual({ ok: false, message: "Deal could not be duplicated. Check your access and try again." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
