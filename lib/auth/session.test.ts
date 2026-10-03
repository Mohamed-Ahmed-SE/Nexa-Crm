import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";

describe("auth session verification", () => {
  it("allows a missing session", () => {
    expect(() => throwIfAuthVerificationFailed(new AuthSessionMissingError())).not.toThrow();
  });

  it("keeps real auth API errors fatal", () => {
    expect(() => throwIfAuthVerificationFailed(new AuthApiError("Invalid token", 401, "invalid_token")))
      .toThrow("Unable to verify the current session.");
  });
});
