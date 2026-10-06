import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  leadLookup: {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { convertLeadAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const pipelineId = "8d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const stageId = "7d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";

function conversionForm(id = leadId) {
  const form = new FormData();
  form.set("id", id);
  form.set("createContact", "on");
  form.set("createDeal", "on");
  form.set("contactFirstName", "Taylor");
  form.set("contactLastName", "Reed");
  form.set("dealTitle", "Acme opportunity");
  form.set("pipelineId", pipelineId);
  form.set("stageId", stageId);
  form.set("dealOwnerId", userId);
  form.set("dealValue", "1200.50");
  form.set("closeDate", "2026-12-31");
  return form;
}

const sourceLead = { id: leadId, status: "qualified", owner_id: userId };

describe("lead conversion action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.leadLookup.select.mockReturnThis();
    mocks.leadLookup.eq.mockReturnThis();
    mocks.leadLookup.is.mockReturnThis();
    mocks.leadLookup.maybeSingle.mockResolvedValue({ data: sourceLead, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ from: () => mocks.leadLookup, rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { contactId: "a1100000-0000-4000-8000-000000000001", companyId: null, dealId: "a1100000-0000-4000-8000-000000000002" }, error: null });
  });

  it("rejects malformed conversion options before querying or creating records", async () => {
    const form = conversionForm();
    form.set("stageId", "foreign-stage");

    const response = await convertLeadAction(form);

    expect(response.ok).toBeUndefined();
    expect(response.fieldErrors).toHaveProperty("stageId");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the authorized workspace RPC and returns created IDs", async () => {
    const response = await convertLeadAction(conversionForm());

    expect(response).toMatchObject({ ok: true, contactId: "a1100000-0000-4000-8000-000000000001", companyId: null, dealId: "a1100000-0000-4000-8000-000000000002" });
    expect(mocks.rpc).toHaveBeenCalledWith("convert_lead", {
      target_workspace_id: workspaceId,
      target_lead_id: leadId,
      conversion: expect.objectContaining({ createContact: true, createDeal: true, dealOwnerId: userId, dealValue: 1200.5 }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
  });

  it("completes contact-only conversion when deal fields are omitted", async () => {
    const form = conversionForm();
    for (const field of ["createDeal", "dealTitle", "pipelineId", "stageId", "dealOwnerId", "dealValue", "closeDate"]) form.delete(field);
    mocks.rpc.mockResolvedValue({ data: { contactId: "a1100000-0000-4000-8000-000000000001", companyId: null, dealId: null }, error: null });

    const response = await convertLeadAction(form);

    expect(response).toMatchObject({ ok: true, contactId: "a1100000-0000-4000-8000-000000000001", dealId: null });
    expect(mocks.rpc).toHaveBeenCalledWith("convert_lead", expect.objectContaining({
      conversion: expect.objectContaining({ createDeal: false, dealOwnerId: null, pipelineId: null, stageId: null, dealValue: null }),
    }));
  });

  it("does not invoke the conversion RPC for a lead owned by another member", async () => {
    mocks.leadLookup.maybeSingle.mockResolvedValue({ data: { ...sourceLead, owner_id: "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2" }, error: null });

    const response = await convertLeadAction(conversionForm());

    expect(response.message).toMatch(/assigned to you/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts an active deal owner for a manager", async () => {
    const ownerId = "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2";
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    const form = conversionForm();
    form.set("dealOwnerId", ownerId);
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ user_id: ownerId }], error: null })
      .mockResolvedValueOnce({ data: { contactId: "a1100000-0000-4000-8000-000000000001", companyId: null, dealId: "a1100000-0000-4000-8000-000000000002" }, error: null });

    const response = await convertLeadAction(form);

    expect(response.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("convert_lead", expect.objectContaining({
      conversion: expect.objectContaining({ dealOwnerId: ownerId }),
    }));
  });

  it("does not let a member assign the deal to someone else", async () => {
    const form = conversionForm();
    form.set("dealOwnerId", "c2d648c6-8d8f-4a16-90c4-72f3c31c61a2");

    const response = await convertLeadAction(form);

    expect(response.message).toMatch(/only to yourself/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("completes and refreshes when returned record links are malformed", async () => {
    mocks.rpc.mockResolvedValue({ data: { contactId: "unsafe", companyId: null, dealId: null }, error: null });

    const response = await convertLeadAction(conversionForm());

    expect(response).toMatchObject({ ok: true, conversionCompleted: true });
    expect(response.message).toMatch(/Conversion completed/);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads");
  });

  it("keeps database conversion failures as an error response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("transaction failed") });

    const response = await convertLeadAction(conversionForm());

    expect(response.ok).toBeUndefined();
    expect(response.message).toMatch(/No records were created/);
  });
});
