import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/auth/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("password reset actions", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        resetPasswordForEmail: mocks.resetPasswordForEmail,
        updateUser: mocks.updateUser,
      },
    });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.test");
  });

  it("rejects an invalid email before contacting Supabase Auth", async () => {
    const result = await forgotPasswordAction({ message: "" }, form({ email: "not-an-email" }));

    expect(result).toEqual({ message: "Enter a valid email address." });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("returns the same generic success response and sends reset links to the configured callback", async () => {
    const result = await forgotPasswordAction({ message: "" }, form({ email: "person@example.test" }));

    expect(result).toEqual({
      success: true,
      message: "If an account exists for that email, a reset link is on its way.",
    });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("person@example.test", {
      redirectTo: "https://crm.example.test/auth/callback?next=/auth/reset-password",
    });
  });

  it("rejects mismatched passwords before updating the account", async () => {
    const result = await resetPasswordAction(
      { message: "" },
      form({ password: "a-secure-password-123", confirmPassword: "a-different-password" }),
    );

    expect(result).toEqual({ message: "Passwords do not match." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("redirects to the dashboard after Supabase Auth accepts the new password", async () => {
    await expect(resetPasswordAction(
      { message: "" },
      form({ password: "a-secure-password-123", confirmPassword: "a-secure-password-123" }),
    )).rejects.toThrow("REDIRECT:/app/dashboard");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "a-secure-password-123" });
  });

  it("returns an invalid-link response when Supabase Auth rejects the password update", async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error("expired link") });

    const result = await resetPasswordAction(
      { message: "" },
      form({ password: "a-secure-password-123", confirmPassword: "a-secure-password-123" }),
    );

    expect(result).toEqual({ message: "The reset link is invalid or expired. Request a new one." });
  });
});
