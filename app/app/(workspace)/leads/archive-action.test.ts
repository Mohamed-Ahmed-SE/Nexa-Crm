import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { archiveLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";

function archiveForm(id = leadId) {
  const form = new FormData();
  form.set("id", id);
  return form;
}

function setupArchiveQuery(response: { data: { id: string } | null; error: { message: string } | null }) {
  mocks.update.mockReturnValue({
    eq: mocks.eq.mockReturnThis(),
    is: mocks.is.mockReturnThis(),
    select: mocks.select.mockReturnThis(),
    maybeSingle: mocks.maybeSingle.mockResolvedValue(response),
  });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("archiveLeadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", role: "manager" });
    setupArchiveQuery({ data: { id: leadId }, error: null });
  });

  it("archives an active lead only inside the authorized workspace", async () => {
    const response = await archiveLeadAction({}, archiveForm());

    expect(response).toEqual({ ok: true, message: "Lead archived." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.archive");
    expect(mocks.from).toHaveBeenCalledWith("leads");
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "id", leadId);
    expect(mocks.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
  });

  it("rejects invalid IDs before contacting the database", async () => {
    const response = await archiveLeadAction({}, archiveForm("invalid"));

    expect(response).toEqual({ message: "This lead could not be identified." });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates authorization failures without using the database", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Not authorized"));

    await expect(archiveLeadAction({}, archiveForm())).rejects.toThrow("Not authorized");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reports update errors and unavailable or already archived leads", async () => {
    setupArchiveQuery({ data: null, error: { message: "Update failed" } });
    const updateError = await archiveLeadAction({}, archiveForm());

    setupArchiveQuery({ data: null, error: null });
    const missingLead = await archiveLeadAction({}, archiveForm());

    expect(updateError).toEqual({ message: "Unable to archive this lead. Refresh the list and try again." });
    expect(missingLead).toEqual({ message: "Lead not found or already archived." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
