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

import { archiveDealAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";

function archiveForm(id = dealId) {
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

describe("archiveDealAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", role: "manager" });
    setupArchiveQuery({ data: { id: dealId }, error: null });
  });

  it("archives an active deal only inside the authorized workspace", async () => {
    const response = await archiveDealAction(archiveForm());

    expect(response).toEqual({ ok: true, message: "Deal archived." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.archive");
    expect(mocks.from).toHaveBeenCalledWith("deals");
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "id", dealId);
    expect(mocks.is).toHaveBeenCalledWith("archived_at", null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it("rejects invalid IDs without changing or revalidating a deal", async () => {
    const response = await archiveDealAction(archiveForm("invalid"));

    expect(response).toEqual({ ok: false, message: "This deal could not be identified." });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates authorization failures without contacting the database", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Not authorized"));

    await expect(archiveDealAction(archiveForm())).rejects.toThrow("Not authorized");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: "database update errors",
      queryResponse: { data: null, error: { message: "Update failed" } },
      expected: { ok: false, message: "Unable to archive this deal. Refresh and try again." },
    },
    {
      scenario: "no active row matches (missing or already archived deal)",
      queryResponse: { data: null, error: null },
      expected: { ok: false, message: "Deal not found or already archived." },
    },
  ])("reports failure for $scenario", async ({ queryResponse, expected }) => {
    setupArchiveQuery(queryResponse);

    const response = await archiveDealAction(archiveForm());

    expect(response).toEqual(expected);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
