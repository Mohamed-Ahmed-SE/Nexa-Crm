import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { GET } from "./route";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const fileId = "3f73ca78-1538-4e41-92bb-684affd25a01";

function setup(attachment: { storage_path: string; filename: string } | null) {
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", role: "viewer" });
  mocks.eq.mockReturnThis();
  mocks.maybeSingle.mockResolvedValue({ data: attachment, error: null });
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://private.example/signed-download" }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq, maybeSingle: mocks.maybeSingle };
  mocks.createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query), storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) } });
}

describe("deal file download route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires crm.view and redirects to a short-lived scoped signed URL privately", async () => {
    setup({ storage_path: `${workspaceId}/deal/uuid/proposal.pdf`, filename: "proposal.pdf" });

    const response = await GET(new Request("https://nexa.example/app/deals/files/" + fileId), { params: Promise.resolve({ fileId }) });

    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.view");
    expect(mocks.eq.mock.calls).toEqual([["workspace_id", workspaceId], ["id", fileId], ["related_entity_type", "deal"]]);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(`${workspaceId}/deal/uuid/proposal.pdf`, 60, { download: "proposal.pdf" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://private.example/signed-download");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not sign a missing workspace-scoped deal attachment", async () => {
    setup(null);

    const response = await GET(new Request("https://nexa.example"), { params: Promise.resolve({ fileId }) });

    expect(response.status).toBe(404);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
