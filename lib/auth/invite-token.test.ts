import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, isValidInviteToken } from "@/lib/auth/invite-token";

describe("workspace invitation tokens", () => {
  it("creates unique URL-safe tokens with the accepted encoding", () => {
    const first = createInviteToken();
    const second = createInviteToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isValidInviteToken(first)).toBe(true);
    expect(second).not.toBe(first);
  });

  it("hashes a token deterministically without retaining the raw secret", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
  });

  it.each([
    "",
    "not-a-token",
    "a".repeat(42),
    "a".repeat(44),
    `${"a".repeat(42)}!`,
  ])("rejects malformed invitation token %s", (token) => {
    expect(isValidInviteToken(token)).toBe(false);
  });
});
