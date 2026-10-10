import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deactivatePipelineStageAction } from "./actions";

function stageForm(stageId: string) {
  const form = new FormData();
  form.set("stageId", stageId);
  return form;
}

describe("deactivatePipelineStageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId: "workspace-1" });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("deactivates the stage and revalidates affected routes after success", async () => {
    const stageId = "f1300000-0000-4000-8000-000000000001";
    const state = await deactivatePipelineStageAction({}, stageForm(stageId));

    expect(state).toEqual({ ok: true, message: "Stage disabled." });
    expect(mocks.rpc).toHaveBeenCalledWith("deactivate_pipeline_stage", { target_stage_id: stageId });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings/pipeline");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
  });

  it.each([
    ["PST01", "This stage still has open deals. Move or close them before disabling it."],
    ["PST02", "This stage is inactive and cannot receive deals."],
    ["22023",  "Only an active open stage can be disabled. Refresh and try again."],
    ["42501", "Only workspace admins can manage pipeline stages."],
  ])("maps %s to an actionable refusal", async (code, message) => {
    mocks.rpc.mockResolvedValue({ error: { code } });
    const state = await deactivatePipelineStageAction({}, stageForm("f1300000-0000-4000-8000-000000000001"));

    expect(state).toEqual({ message });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates workspace permission refusals before database access", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Not authorized"));

    await expect(deactivatePipelineStageAction({}, stageForm("f1300000-0000-4000-8000-000000000001"))).rejects.toThrow("Not authorized");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects malformed stage identifiers before creating a Supabase client", async () => {
    const state = await deactivatePipelineStageAction({}, stageForm("not-a-uuid"));

    expect(state).toEqual({ message: "Choose a valid stage and try again." });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
