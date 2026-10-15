import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { uploadDealFileAction } from "./file-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const ownerId = "94bb6282-32b1-441b-a3ef-5eb305dc6f92";

function makeTestFile(contents: string, name: string, type: string) {
  const file = new File([contents], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(contents).buffer });
  return file;
}

function uploadForm(file = makeTestFile("%PDF", "proposal.pdf", "application/pdf")) {
  const form = new FormData();
  form.set("dealId", dealId);
  form.set("file", file);
  return form;
}

function configure(role: string, dealOwner = userId, storageError: { message: string } | null = null, cleanupError: { message: string } | null = null) {
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role });
  const dealQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: dealId, owner_id: dealOwner }, error: null }) };
  const metadataInsert = vi.fn().mockResolvedValue({ error: null });
  const metadataDelete = { eq: vi.fn().mockReturnThis() };
  metadataDelete.eq.mockReturnValueOnce(metadataDelete).mockReturnValueOnce({ then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: cleanupError }).then(resolve) });
  const attachments = { insert: metadataInsert, delete: vi.fn(() => metadataDelete) };
  mocks.from.mockImplementation((table: string) => table === "deals" ? dealQuery : attachments);
  mocks.upload.mockResolvedValue({ error: storageError });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn(() => ({ upload: mocks.upload })) } });
  return { metadataInsert, dealQuery, attachments };
}

describe("deal file upload action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "3f73ca78-1538-4e41-92bb-684affd25a01" });
  });

  it("stores a valid file under the authenticated workspace and deal, then revalidates the deal", async () => {
    const { metadataInsert } = configure("member");
    const result = await uploadDealFileAction({}, uploadForm());

    expect(result).toEqual({ ok: true, message: "File uploaded." });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.edit.own");
    expect(metadataInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "3f73ca78-1538-4e41-92bb-684affd25a01",
      workspace_id: workspaceId,
      storage_path: `${workspaceId}/${dealId}/3f73ca78-1538-4e41-92bb-684affd25a01/proposal.pdf`,
      uploaded_by: userId,
      related_entity_type: "deal",
      related_entity_id: dealId,
      mime_type: "application/pdf",
      size_bytes: 4,
    }));
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringContaining(`${workspaceId}/${dealId}/`), expect.any(Uint8Array), { contentType: "application/pdf", upsert: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/deals/${dealId}`);
  });

  it("blocks a member from uploading to a peer-owned deal", async () => {
    const { metadataInsert } = configure("member", ownerId);
    const result = await uploadDealFileAction({}, uploadForm());

    expect(result).toEqual({ message: "You can upload files only to deals assigned to you." });
    expect(metadataInsert).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("allows a manager to upload to a deal they do not own", async () => {
    configure("manager", ownerId);

    expect(await uploadDealFileAction({}, uploadForm())).toEqual({ ok: true, message: "File uploaded." });
  });

  it("rejects malformed deal identifiers before accessing the server", async () => {
    configure("member");
    const invalidDealForm = uploadForm();
    invalidDealForm.set("dealId", "not-a-uuid");

    expect(await uploadDealFileAction({}, invalidDealForm)).toEqual({ message: "Choose a file to upload." });
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });

  it("rejects a file whose signature disagrees with its declared type", async () => {
    configure("member");

    expect(await uploadDealFileAction({}, uploadForm(makeTestFile("nope", "proposal.pdf", "application/pdf")))).toEqual({ message: "The file content does not match its declared type." });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("removes attachment metadata when the private storage upload fails", async () => {
    const { attachments } = configure("admin", ownerId, { message: "storage unavailable" });

    expect(await uploadDealFileAction({}, uploadForm())).toEqual({ message: "Unable to upload this file." });
    expect(attachments.delete).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports when cleanup fails after a storage upload failure", async () => {
    const { attachments } = configure("admin", ownerId, { message: "storage unavailable" }, { message: "database unavailable" });

    expect(await uploadDealFileAction({}, uploadForm())).toEqual({ message: "Upload failed and file details could not be cleaned up. Contact support." });
    expect(attachments.delete).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
