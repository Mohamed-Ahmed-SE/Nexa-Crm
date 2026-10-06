import { describe, expect, it } from "vitest";
import { isRetainingRelation, needsRetainedRelationOption } from "@/lib/leads/relations";

describe("existing lead relationships", () => {
  it.each([
    ["inactive source", "source-old", ["source-active"]],
    ["inactive owner", "owner-old", ["owner-active"]],
  ])("retains an unavailable %s as the selected edit value", (_kind, currentId, selectableIds) => {
    expect(needsRetainedRelationOption(currentId, selectableIds)).toBe(true);
  });

  it.each([
    ["unchanged ID", "member-current", "member-current", true],
    ["different ID", "member-active", "member-current", false],
    ["cleared ID", null, "member-current", false],
    ["unassigned current", null, null, false],
  ])("allows inactive retention only for an exact %s", (_scenario, submittedId, currentId, expected) => {
    expect(isRetainingRelation(submittedId, currentId)).toBe(expected);
  });
});
