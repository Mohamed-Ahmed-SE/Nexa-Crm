import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  leadSelect: vi.fn(),
  leadEq: vi.fn(),
  leadIs: vi.fn(),
  leadMaybeSingle: vi.fn(),
  activityInsert: vi.fn(),
  noteInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { addLeadNoteAction, logLeadActivityAction } from "./engagement-actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const peerId = "1b661392-b532-49ba-b642-78e27f9a8844";

function engagementForm(id = leadId) {
  const form = new FormData();
  form.set("leadId", id);
  return form;
}

function setupLead(ownerId = userId) {
  const leadQuery = {
    select: mocks.leadSelect.mockReturnThis(),
    eq: mocks.leadEq.mockReturnThis(),
    is: mocks.leadIs.mockReturnThis(),
    maybeSingle: mocks.leadMaybeSingle.mockResolvedValue({ data: { id: leadId, owner_id: ownerId }, error: null }),
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "leads") return leadQuery;
    if (table === "activities") return { insert: mocks.activityInsert };
    return { insert: mocks.noteInsert };
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
}

describe("lead engagement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    mocks.activityInsert.mockResolvedValue({ error: null });
    mocks.noteInsert.mockResolvedValue({ error: null });
    setupLead();
  });

  it("logs a self-created manual activity scoped to the current workspace and lead", async () => {
    const form = engagementForm();
    form.set("type", "call");
    form.set("subject", "Discovery call");
    form.set("body", "Discussed timeline.");
    form.set("occurredAt", "2026-04-03T12:00:00.000Z");
    form.set("timezoneOffset", "");

    const result = await logLeadActivityAction({}, form);

    expect(result).toEqual({ ok: true, message: "Activity logged." });
    expect(mocks.activityInsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: workspaceId, created_by: userId, owner_id: userId,
      related_entity_type: "lead", related_entity_id: leadId,
      activity_type: "call", subject: "Discovery call", is_system_event: false,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/leads/${leadId}`);
  });

  it("rejects a member's note to a lead owned by a peer", async () => {
    setupLead(peerId);
    const form = engagementForm();
    form.set("body", "Should not be recorded.");

    const result = await addLeadNoteAction({}, form);

    expect(result.message).toBe("You can update only leads assigned to you.");
    expect(mocks.noteInsert).not.toHaveBeenCalled();
  });

  it("rejects malformed lead IDs before opening a database session", async () => {
    const result = await logLeadActivityAction({}, engagementForm("not-a-uuid"));

    expect(result.message).toBe("This lead could not be identified.");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
