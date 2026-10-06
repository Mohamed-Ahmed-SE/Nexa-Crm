import { describe, expect, it } from "vitest";
import { formatTaskOwners } from "./owner-labels";

describe("task assignee labels", () => {
  it("keeps the current user recognizable and distinguishes workspace members", () => {
    expect(formatTaskOwners([
      { user_id: "a1b2c3d4-current" },
      { user_id: "11223344-member" },
      { user_id: "aabbccdd-member" },
    ], "a1b2c3d4-current")).toEqual([
      { id: "a1b2c3d4-current", label: "You" },
      { id: "11223344-member", label: "Workspace member · 112233" },
      { id: "aabbccdd-member", label: "Workspace member · aabbcc" },
    ]);
  });
});
