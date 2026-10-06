import { describe, expect, it } from "vitest";
import { getOwnerInitials, isDealOverdue } from "./presentation";

describe("deal presentation", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["  Grace   Hopper  ", "GH"],
    ["Prince", "PR"],
  ])("shows recognizable initials for owner %s", (ownerName, expected) => {
    expect(getOwnerInitials(ownerName)).toBe(expected);
  });

  it.each([
    ["open", "2026-04-09", true],
    ["open", "2026-04-10", false],
    ["open", "2026-04-11", false],
    ["open", null, false],
    ["won", "2026-04-09", false],
    ["lost", "2026-04-09", false],
  ] as const)("flags only overdue open deals (%s, %s)", (status, closeDate, expected) => {
    expect(isDealOverdue(status, closeDate, "2026-04-10")).toBe(expected);
  });
});
