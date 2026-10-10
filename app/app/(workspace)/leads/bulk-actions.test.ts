import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { bulkAssignLeadsAction, bulkTagLeadsAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const tagId = "5c144f7b-80bd-48f0-8f4c-75a1859176e6";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

describe("bulk lead actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
  });

  it("assigns every selected lead to a validated workspace member", async () => {
    const selectedLeads = query({ data: [{ id: leadId, owner_id: userId }], error: null });
    const updatedLeads = query({ data: [{ id: leadId }], error: null });
    const update = vi.fn(() => updatedLeads);
    const supabase = {
      from: vi.fn().mockReturnValueOnce({ select: vi.fn(() => selectedLeads) }).mockReturnValueOnce({
        update,
      }),
      rpc: vi.fn().mockResolvedValue({ data: [{ user_id: userId }], error: null }),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await bulkAssignLeadsAction({}, form({ leadIds: leadId, ownerId: userId }));

    expect(result).toMatchObject({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith("list_reassignable_workspace_members", {
      target_workspace_id: workspaceId, target_user_id: userId, target_lead_id: null,
    });
    expect(update).toHaveBeenCalledWith({ owner_id: userId });
    expect(updatedLeads.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("rejects malformed or duplicate selections before touching persistence", async () => {
    const from = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ from });
    const duplicateIds = form({ leadIds: leadId, ownerId: "" });
    duplicateIds.append("leadIds", leadId);

    const result = await bulkAssignLeadsAction({}, duplicateIds);

    expect(result.ok).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a member without the reassignment permission", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Not found"));
    const from = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(bulkAssignLeadsAction({}, form({ leadIds: leadId, ownerId: userId }))).rejects.toThrow("Not found");
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects member tagging for leads assigned to another user", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    const selectedLeads = query({ data: [{ id: leadId, owner_id: "8d5e7d44-5671-4bdf-9e65-a8ff53f780c4" }], error: null });
    const from = vi.fn().mockReturnValue({ select: vi.fn(() => selectedLeads) });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    const result = await bulkTagLeadsAction({}, form({ leadIds: leadId, tagId }));

    expect(result.ok).toBeUndefined();
    expect(result.message).toMatch(/not assigned to you/);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("adds an existing workspace tag without replacing existing tag associations", async () => {
    const selectedLeads = query({ data: [{ id: leadId, owner_id: userId }], error: null });
    const tag = query({ data: { id: tagId }, error: null });
    const existingTags = query({ data: [], error: null });
    const insertedTags = query({ data: [{ entity_id: leadId }], error: null });
    const insert = vi.fn(() => insertedTags);
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce({ select: vi.fn(() => selectedLeads) })
        .mockReturnValueOnce({ select: vi.fn(() => tag) })
        .mockReturnValueOnce({ select: vi.fn(() => existingTags) })
        .mockReturnValueOnce({ insert }),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await bulkTagLeadsAction({}, form({ leadIds: leadId, tagId }));

    expect(result).toMatchObject({ ok: true });
    expect(insert).toHaveBeenCalledWith([{
      workspace_id: workspaceId, tag_id: tagId, entity_type: "lead", entity_id: leadId,
    }]);
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
});
