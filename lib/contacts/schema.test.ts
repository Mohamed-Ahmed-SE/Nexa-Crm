import { describe, expect, it } from "vitest";
import { buildContactSearchFilter, contactInputSchema, parseContactSearchParams } from "@/lib/contacts/schema";

const uuid = "83d8aaf1-c78e-41db-ae18-493f44c84b42";

describe("contactInputSchema", () => {
  it("requires valid names and normalizes optional blanks", () => {
    expect(contactInputSchema.safeParse({ firstName: " ", lastName: "Chen", lifecycleStatus: "active" }).success).toBe(false);
    expect(contactInputSchema.parse({ firstName: " Sarah ", lastName: " Chen ", lifecycleStatus: "customer", email: "", companyId: "" })).toMatchObject({
      firstName: "Sarah", lastName: "Chen", email: null, companyId: null, ownerId: null, phone: null,
    });
  });

  it("rejects invalid IDs, lifecycle values, and malformed links", () => {
    expect(contactInputSchema.safeParse({ firstName: "A", lastName: "B", lifecycleStatus: "prospect", companyId: "forged" }).success).toBe(false);
    expect(contactInputSchema.safeParse({ firstName: "A", lastName: "B", lifecycleStatus: "active", linkedinUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(() => contactInputSchema.safeParse({ firstName: "A", lastName: "B", lifecycleStatus: "active", linkedinUrl: "not-a-url" })).not.toThrow();
    expect(contactInputSchema.safeParse({ firstName: "A", lastName: "B", lifecycleStatus: "active", linkedinUrl: "not-a-url" }).success).toBe(false);
  });
});

describe("contact search filters", () => {
  it("accepts bounded filters and defaults invalid parameter groups", () => {
    expect(parseContactSearchParams({ q: " Chen ", lifecycle: "customer", company: uuid, owner: "unassigned", page: "3" })).toEqual({
      q: "Chen", lifecycle: "customer", companyId: uuid, ownerId: "unassigned", page: 3,
    });
    expect(parseContactSearchParams({ q: "x".repeat(101), lifecycle: "unknown", company: "other", owner: "other", page: "0" })).toEqual({
      q: "", lifecycle: "all", companyId: "", ownerId: "", page: 1,
    });
  });

  it("escapes wildcard syntax and searches contact fields", () => {
    expect(buildContactSearchFilter('Chen%_"')).toBe('first_name.ilike."%Chen\\%\\_\\\"%",last_name.ilike."%Chen\\%\\_\\\"%",email.ilike."%Chen\\%\\_\\\"%",phone.ilike."%Chen\\%\\_\\\"%",job_title.ilike."%Chen\\%\\_\\\"%"');
    expect(buildContactSearchFilter("  ")).toBeNull();
  });
});
