import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { deleteCompanyFileAction, uploadCompanyFileAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const companyId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const ownerId = "94bb6282-32b1-441b-a3ef-5eb305dc6f92";
const fileId = "3f73ca78-1538-4e41-92bb-684affd25a01";

function makeTestFile(contents: string, name: string, type: string) {
  const file = new File([contents], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(contents).buffer });
  return file;
}

function uploadForm(file = makeTestFile("%PDF", "proposal.pdf", "application/pdf")) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("file", file);
  return form;
}

function deleteForm(id = fileId) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("fileId", id);
  return form;
}

function configureCompany(role: string, companyOwner = userId) {
  mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role });
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: companyId, workspace_id: workspaceId, owner_id: companyOwner }, error: null }) };
}

describe("company file upload action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a valid file under the authenticated workspace and company, then revalidates the company", async () => {
    const companyQuery = configureCompany("member");
    const attachmentsInsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : { insert: attachmentsInsert });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn(() => ({ upload: mocks.upload })) } });
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => fileId });

    const result = await uploadCompanyFileAction({}, uploadForm());

    expect(result).toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/companies/${companyId}`);
  });

  it("blocks a member from uploading to a peer-owned company", async () => {
    const companyQuery = configureCompany("member", ownerId);
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : {});
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn() } });

    const result = await uploadCompanyFileAction({}, uploadForm());

    expect(result).toEqual({ message: "You can update only companies assigned to you." });
  });

  it("rejects a file whose signature disagrees with its declared type", async () => {
    const companyQuery = configureCompany("member");
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : {});
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn() } });

    const result = await uploadCompanyFileAction({}, uploadForm(makeTestFile("nope", "proposal.pdf", "application/pdf")));

    expect(result).toEqual({ message: "The file content does not match its declared type." });
  });

  it("rejects malformed company identifiers before accessing the server", async () => {
    const invalidForm = uploadForm();
    invalidForm.set("companyId", "not-a-uuid");

    const result = await uploadCompanyFileAction({}, invalidForm);

    expect(result).toEqual({ message: "Choose a file to upload." });
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });
});

describe("company file delete action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the storage object and attachment row, then revalidates the company", async () => {
    const companyQuery = configureCompany("member");
    const attachmentSelectQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: fileId, storage_path: `${workspaceId}/${companyId}/${fileId}/report.pdf` }, error: null }) };
    const attachmentDeleteQuery = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: fileId }, error: null }) };
    const attachmentsTable = { ...attachmentSelectQuery, delete: vi.fn().mockReturnValue(attachmentDeleteQuery) };
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : attachmentsTable);
    mocks.remove.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn(() => ({ remove: mocks.remove })) } });

    const result = await deleteCompanyFileAction({}, deleteForm());

    expect(result).toEqual({ ok: true, message: "File deleted." });
    expect(mocks.remove).toHaveBeenCalledWith([`${workspaceId}/${companyId}/${fileId}/report.pdf`]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/companies/${companyId}`);
  });

  it("blocks a member from deleting a file on a peer-owned company", async () => {
    const companyQuery = configureCompany("member", ownerId);
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : {});
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn() } });

    const result = await deleteCompanyFileAction({}, deleteForm());

    expect(result).toEqual({ message: "You can update only companies assigned to you." });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("reports not found when the file does not belong to this company or workspace", async () => {
    const companyQuery = configureCompany("member");
    const attachmentSelectQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : attachmentSelectQuery);
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn(() => ({ remove: mocks.remove })) } });

    const result = await deleteCompanyFileAction({}, deleteForm());

    expect(result).toEqual({ message: "File not found. Refresh and try again." });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("reports a storage failure without deleting the metadata row", async () => {
    const companyQuery = configureCompany("member");
    const attachmentSelectQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: fileId, storage_path: `${workspaceId}/${companyId}/${fileId}/report.pdf` }, error: null }) };
    const deleteSpy = vi.fn();
    const attachmentsTable = { ...attachmentSelectQuery, delete: deleteSpy };
    mocks.from.mockImplementation((table: string) => table === "companies" ? companyQuery : attachmentsTable);
    mocks.remove.mockResolvedValue({ error: { message: "storage unavailable" } });
    mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from, storage: { from: vi.fn(() => ({ remove: mocks.remove })) } });

    const result = await deleteCompanyFileAction({}, deleteForm());

    expect(result).toEqual({ message: "Unable to delete this file. Try again." });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed file identifiers before accessing the server", async () => {
    const invalidForm = deleteForm("not-a-uuid");

    const result = await deleteCompanyFileAction({}, invalidForm);

    expect(result).toEqual({ message: "This file could not be identified." });
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });
});
