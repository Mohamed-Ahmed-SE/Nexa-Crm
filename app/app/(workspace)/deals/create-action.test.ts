import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  activityInsert: vi.fn(),
  dealInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createDealAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const pipelineId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const stageId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function dealForm() {
  const form = new FormData();
  form.set("title", "Renewal opportunity");
  form.set("companyId", "");
  form.set("contactId", "");
  form.set("amount", "12000");
  form.set("expectedCloseDate", "");
  form.set("ownerId", "");
  form.set("priority", "medium");
  form.set("description", "");
  form.set("pipelineId", pipelineId);
  return form;
}

function setupCreation(
  dealResult: { data: { id: string } | null; error: Error | null } = { data: { id: dealId }, error: null },
  activityError: Error | null = null,
) {
  const workspaceQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { default_currency: "USD" }, error: null }),
  };
  const pipelineQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: pipelineId }, error: null }),
  };
  const stageQuery = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: stageId }, error: null }),
  };
  const insertQuery = {
    select: vi.fn().mockReturnThis(),
    maybeSingle: mocks.dealInsert.mockResolvedValue(dealResult),
  };
  const workspaceTable = { select: vi.fn().mockReturnValue(workspaceQuery) };
  const pipelineTable = { select: vi.fn().mockReturnValue(pipelineQuery) };
  const stageTable = { select: vi.fn().mockReturnValue(stageQuery) };
  const dealTable = { insert: vi.fn().mockReturnValue(insertQuery) };
  const activityTable = { insert: mocks.activityInsert.mockResolvedValue({ error: activityError }) };
  mocks.from.mockImplementation((table: string) => {
    if (table === "workspaces") return workspaceTable;
    if (table === "pipelines") return pipelineTable;
    if (table === "pipeline_stages") return stageTable;
    if (table === "deals") return dealTable;
    return activityTable;
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("create deal action timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupCreation();
  });

  it("records the creation event and revalidates the created deal", async () => {
    const response = await createDealAction(dealForm());

    expect(response).toEqual({ ok: true, message: "Deal added." });
    expect(mocks.activityInsert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      activity_type: "record_created",
      subject: "Deal created",
      body: null,
      occurred_at: expect.any(String),
      created_by: userId,
      owner_id: userId,
      related_entity_type: "deal",
      related_entity_id: dealId,
      metadata: {},
      is_system_event: false,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it.each([
    ["database error", { data: null, error: new Error("insert failed") }],
    ["missing inserted row", { data: null, error: null }],
  ])("does not report creation or record an event after a %s", async (_scenario, dealResult) => {
    setupCreation(dealResult);

    const response = await createDealAction(dealForm());

    expect(response).toEqual({ ok: false, message: "Deal could not be created. Check your access and try again." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the deal creation successful and warns when its event cannot be recorded", async () => {
    setupCreation({ data: { id: dealId }, error: null }, new Error("activity insert failed"));

    const response = await createDealAction(dealForm());

    expect(response).toEqual({ ok: true, message: "Deal added, but its activity could not be recorded." });
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });
});
