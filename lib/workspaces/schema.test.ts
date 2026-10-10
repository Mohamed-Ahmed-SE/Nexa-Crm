import { describe, expect, it } from "vitest";
import { workspaceSettingsSchema } from "./schema";

const validSettings = {
  name: "  Nexa workspace  ",
  logoUrl: "  https://example.com/logo.svg  ",
  defaultCurrency: " usd ",
  timezone: " America/New_York ",
};

describe("workspaceSettingsSchema", () => {
  it("normalizes valid workspace settings", () => {
    expect(workspaceSettingsSchema.parse(validSettings)).toEqual({
      name: "Nexa workspace",
      logoUrl: "https://example.com/logo.svg",
      defaultCurrency: "USD",
      timezone: "America/New_York",
    });
  });

  it.each(["ab", "a".repeat(80)])("accepts workspace names at the boundary: %s", (name) => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name }).success).toBe(true);
  });

  it.each(["a", "a".repeat(81)])("rejects workspace names outside the boundary: %s", (name) => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name }).success).toBe(false);
  });

  it("accepts two emoji as two PostgreSQL character values", () => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name: "😀😀" }).success).toBe(true);
  });

  it("rejects one emoji as a single PostgreSQL character value", () => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name: "😀" }).success).toBe(false);
  });

  it("accepts 80 emoji code points", () => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name: "😀".repeat(80) }).success).toBe(true);
  });

  it("rejects 81 emoji code points", () => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, name: "😀".repeat(81) }).success).toBe(false);
  });

  it("allows an empty logo URL to clear the current logo", () => {
    expect(workspaceSettingsSchema.parse({ ...validSettings, logoUrl: "  " }).logoUrl).toBeNull();
  });

  it.each(["http://example.com/logo.svg", "javascript:alert(1)", "https://user:pass@example.com/logo.svg", "not a URL"])(
    "rejects unsafe logo URL %s",
    (logoUrl) => {
      expect(workspaceSettingsSchema.safeParse({ ...validSettings, logoUrl }).success).toBe(false);
    },
  );

  it.each([
    { name: "   ", timezone: "UTC", defaultCurrency: "USD" },
    { name: "Workspace", timezone: "Mars/Olympus", defaultCurrency: "USD" },
    { name: "Workspace", timezone: "UTC", defaultCurrency: "US" },
    { name: "Workspace", timezone: "UTC", defaultCurrency: "ZZZ" },
  ])("rejects invalid workspace setting values: %o", (override) => {
    expect(workspaceSettingsSchema.safeParse({ ...validSettings, ...override }).success).toBe(false);
  });
});
