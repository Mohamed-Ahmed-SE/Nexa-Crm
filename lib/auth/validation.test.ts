import { describe, expect, it } from "vitest";
import { createWorkspaceSchema, resetPasswordSchema, safeInternalPath, signInSchema } from "@/lib/auth/validation";

describe("authentication validation", () => {
  it("requires a valid email and non-empty sign-in password", () => {
    expect(signInSchema.safeParse({ email: "person@example.com", password: "old-password" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "not-an-email", password: "" }).success).toBe(false);
  });

  it("requires a long matching password for resets", () => {
    expect(resetPasswordSchema.safeParse({ password: "correct-horse-battery", confirmPassword: "correct-horse-battery" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "correct-horse-battery", confirmPassword: "different-password" }).success).toBe(false);
  });

  it("requires workspace name while allowing a blank optional job title", () => {
    expect(createWorkspaceSchema.safeParse({ name: "Acme Sales", jobTitle: "" }).success).toBe(true);
    expect(createWorkspaceSchema.safeParse({ name: " A ", jobTitle: "" }).success).toBe(false);
  });
});

describe("safe internal redirect destinations", () => {
  it.each([
    ["/app/leads?view=mine", "/app/leads?view=mine"],
    ["https://evil.example", "/app/dashboard"],
    ["//evil.example/steal", "/app/dashboard"],
    ["/\\evil.example", "/app/dashboard"],
    ["/app/\u0000bad", "/app/dashboard"],
  ])("keeps %s within the app", (candidate, expected) => {
    expect(safeInternalPath(candidate)).toBe(expected);
  });
});
