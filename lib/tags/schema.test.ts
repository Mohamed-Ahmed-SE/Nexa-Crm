import { describe, expect, it } from "vitest";
import { tagIdSchema, tagNameSchema } from "./schema";

describe("tag input validation", () => {
  it.each([
    [" padded name ", true],
    ["x", true],
    ["x".repeat(80), true],
    ["", false],
    ["   ", false],
    ["x".repeat(81), false],
  ])("validates tag names at the %j boundary", (name, valid) => {
    expect(tagNameSchema.safeParse(name).success).toBe(valid);
  });

  it.each([
    ["0f7fdd9a-56c9-49d6-b675-25bb4a728713", true],
    ["not-a-uuid", false],
    ["", false],
  ])("validates tag ids at the %j boundary", (id, valid) => {
    expect(tagIdSchema.safeParse(id).success).toBe(valid);
  });
});
