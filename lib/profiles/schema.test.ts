import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/profiles/schema";

const validProfile = {
  fullName: "  Alex Chen  ",
  avatarUrl: " https://images.example.com/alex.png ",
  phone: "  +1 555 0100  ",
  jobTitle: "  Sales manager  ",
  timezone: " America/New_York ",
};

describe("profileSchema", () => {
  it("trims values and normalizes blank optional fields to null", () => {
    expect(profileSchema.parse({ ...validProfile, avatarUrl: " ", phone: " ", jobTitle: "" })).toEqual({
      fullName: "Alex Chen",
      avatarUrl: null,
      phone: null,
      jobTitle: null,
      timezone: "America/New_York",
    });
  });

  it("accepts a normalized HTTPS avatar URL and bounded profile fields", () => {
    expect(profileSchema.parse(validProfile)).toEqual({
      fullName: "Alex Chen",
      avatarUrl: "https://images.example.com/alex.png",
      phone: "+1 555 0100",
      jobTitle: "Sales manager",
      timezone: "America/New_York",
    });
  });

  it.each(["http://images.example.com/avatar.png", "https://user:pass@example.com/avatar.png", "javascript:alert(1)", "not a URL"])("rejects unsafe avatar URL %s", (avatarUrl) => {
    expect(profileSchema.safeParse({ ...validProfile, avatarUrl }).success).toBe(false);
  });

  it("rejects missing names, excessive lengths, and invalid IANA timezones", () => {
    expect(profileSchema.safeParse({ ...validProfile, fullName: "   " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, fullName: "a".repeat(101) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, phone: "1".repeat(51) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, jobTitle: "x".repeat(101) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});
