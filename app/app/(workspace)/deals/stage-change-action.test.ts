import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  activityInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { moveDealStageAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const sourceStageId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const targetStageId = "eb591b6b-660b-4a9c-90ad-88a5f9e1dfe7";

function createDealRead() {
  return {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: dealId, stage_id: sourceStageId, status: "open", owner_id: userId, pipeline_id: "pipeline-1" },
      error: null,
    }),
  };
}

function createTargetStageRead() {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: targetStageId, name: "Negotiation", stage_type: "open" },
      error: null,
    }),
  };
}

function createGuardedMoveQuery(moveResult: { data: { id: string } | null; error: Error | null }) {
  return {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(moveResult),
  };
}

function setupMove(
  activityError: Error | null = null,
  moveResult: { data: { id: string } | null; error: Error | null } = { data: { id: dealId }, error: null },
) {
  const dealsTable = {
    select: vi.fn().mockReturnValue(createDealRead()),
    update: vi.fn().mockReturnValue(createGuardedMoveQuery(moveResult)),
  };
  const stagesTable = { select: vi.fn().mockReturnValue(createTargetStageRead()) };
  const activityTable = { insert: mocks.activityInsert.mockResolvedValue({ error: activityError }) };
  mocks.from.mockImplementation((table: string) => table === "deals" ? dealsTable : table === "pipeline_stages" ? stagesTable : activityTable);
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("move deal stage action timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    setupMove();
  });

  it("records the target stage after successfully moving the deal", async () => {
    const response = await moveDealStageAction(dealId, sourceStageId, targetStageId);

    expect(response).toEqual({ ok: true, message: "Deal moved." });
    expect(mocks.activityInsert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      activity_type: "stage_changed",
      subject: "Stage changed to Negotiation",
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

  it("does not log or revalidate when the guarded move affects no deal", async () => {
    setupMove(null, { data: null, error: null });

    const response = await moveDealStageAction(dealId, sourceStageId, targetStageId);

    expect(response).toEqual({ ok: false, message: "The deal could not be moved. Its previous stage has been kept." });
    expect(mocks.activityInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps a successful move and warns when its activity cannot be recorded", async () => {
    setupMove(new Error("activity insert failed"));

    const response = await moveDealStageAction(dealId, sourceStageId, targetStageId);

    expect(response).toEqual({ ok: true, message: "Deal moved, but its activity could not be recorded." });
    expect(mocks.activityInsert).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });
});
