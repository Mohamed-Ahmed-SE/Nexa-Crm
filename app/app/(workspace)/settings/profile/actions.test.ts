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

import { updateProfileAction } from "./actions";

function profileForm(values: Partial<Record<string, string>> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    fullName: "Alex Chen",
    avatarUrl: "https://images.example.com/alex.png",
    phone: "",
    jobTitle: "Sales manager",
    timezone: "America/New_York",
    ...values,
  })) form.set(key, value);
  return form;
}

describe("updateProfileAction", () => {
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

  it("rejects invalid input before creating a Supabase client", async () => {
    const state = await updateProfileAction({}, profileForm({ avatarUrl: "http://unsafe.example/avatar.png" }));
    expect(state.ok).toBeUndefined();
    expect(state.fieldErrors?.avatarUrl).toBeDefined();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("updates only the authenticated profile row and revalidates the app shell", async () => {
    const state = await updateProfileAction({}, profileForm({ phone: "  ", avatarUrl: " " }));
    expect(state).toEqual({ ok: true, message: "Profile saved." });
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({
      full_name: "Alex Chen",
      avatar_url: null,
      phone: null,
      job_title: "Sales manager",
      timezone: "America/New_York",
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("returns safe failures for missing configuration, auth, or database access", async () => {
    mocks.createSupabaseServerClient.mockResolvedValueOnce(null);
    expect((await updateProfileAction({}, profileForm())).message).toMatch(/not configured/);

    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await updateProfileAction({}, profileForm())).message).toMatch(/Sign in/);

    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error("database detail") });
    expect((await updateProfileAction({}, profileForm())).message).toMatch(/Unable to save/);
  });
});
