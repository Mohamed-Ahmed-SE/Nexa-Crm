import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { updateDateFormatAction } from "./preferences-actions";

function preferenceForm(dateFormat: string) {
  const form = new FormData();
  form.set("dateFormat", dateFormat);
  return form;
}

describe("updateDateFormatAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "user-1" }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  });

  it("rejects unsupported choices before database access", async () => {
    const state = await updateDateFormatAction({}, preferenceForm("YYYY/MM/DD"));
    expect(state.ok).toBeUndefined();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("updates only the authenticated profile and revalidates the workspace", async () => {
    const state = await updateDateFormatAction({}, preferenceForm("DD/MM/YYYY"));
    expect(state).toEqual({ ok: true, message: "Date format saved." });
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({ date_format: "DD/MM/YYYY" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });
});
