import { describe, expect, it } from "vitest";
import { buildLeadSearchFilter, leadInputSchema, parseLeadSearchParams } from "@/lib/leads/schema";

const validLead = {
  fullName: "  Taylor Reed  ", companyName: " Acme ", email: "taylor@example.com", phone: "", jobTitle: "Director",
  sourceId: "", status: "new", ownerId: "", estimatedValue: "1250.50", notesSummary: "",
};

describe("lead input schema", () => {
  it("trims required and optional strings and normalizes blank optional fields", () => {
    expect(leadInputSchema.parse(validLead)).toMatchObject({
      fullName: "Taylor Reed", companyName: "Acme", email: "taylor@example.com", phone: null,
      sourceId: null, ownerId: null, estimatedValue: 1250.5, notesSummary: null,
    });
  });

  it("rejects missing names, invalid emails, negative values, and direct conversion", () => {
    expect(leadInputSchema.safeParse({ ...validLead, fullName: "   " }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...validLead, email: "not-email" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...validLead, estimatedValue: "-1" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...validLead, status: "converted" }).success).toBe(false);
  });
});

describe("lead list query parsing", () => {
  it("accepts the supported filters and bounded page number", () => {
    expect(parseLeadSearchParams({ q: "  Acme ", status: "qualified", owner: "unassigned", page: "3" })).toEqual({
      q: "Acme", status: "qualified", sourceId: "", ownerId: "unassigned", page: 3, sort: "updated_desc",
    });
  });

  it("falls back safely on invalid filters and duplicate query parameters", () => {
    expect(parseLeadSearchParams({ q: ["one", "two"], status: "converted", page: "0" })).toEqual({
      q: "", status: "all", sourceId: "", ownerId: "", page: 1, sort: "updated_desc",
    });
  });
});

describe("PostgREST lead search", () => {
  it("builds a constrained search over supported fields", () => {
    expect(buildLeadSearchFilter("Acme")).toBe('full_name.ilike."%Acme%",company_name.ilike."%Acme%",email.ilike."%Acme%"');
  });

  it("escapes wildcard and filter grammar characters", () => {
    expect(buildLeadSearchFilter('100%_a,"b')).toBe('full_name.ilike."%100\\%\\_a,\\"b%",company_name.ilike."%100\\%\\_a,\\"b%",email.ilike."%100\\%\\_a,\\"b%"');
    expect(buildLeadSearchFilter("   ")).toBeNull();
  });
});
