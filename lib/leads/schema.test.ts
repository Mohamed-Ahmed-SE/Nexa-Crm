import { describe, expect, it } from "vitest";
import { buildLeadSearchFilter, bulkLeadIdsSchema, bulkLeadTagSchema, leadInputSchema, parseLeadSearchParams } from "@/lib/leads/schema";

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

describe("bulk lead input validation", () => {
  const ids = ["9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", "5c144f7b-80bd-48f0-8f4c-75a1859176e6"];

  it("accepts a bounded unique selection and a tag identifier", () => {
    expect(bulkLeadTagSchema.safeParse({ leadIds: ids, tagId: ids[0] }).success).toBe(true);
  });

  it("rejects empty, duplicate, malformed, or oversized selections", () => {
    expect(bulkLeadIdsSchema.safeParse([]).success).toBe(false);
    expect(bulkLeadIdsSchema.safeParse([ids[0], ids[0]]).success).toBe(false);
    expect(bulkLeadIdsSchema.safeParse(["not-a-uuid"]).success).toBe(false);
    expect(bulkLeadIdsSchema.safeParse(Array(26).fill(ids[0])).success).toBe(false);
  });
});

describe("lead list query parsing", () => {
  it("accepts the supported filters and bounded page number", () => {
    expect(parseLeadSearchParams({ q: "  Acme ", status: "qualified", owner: "unassigned", page: "3" })).toEqual({
      q: "Acme", status: "qualified", sourceId: "", ownerId: "unassigned", tagId: "", page: 3, sort: "updated_desc",
    });
  });

  it("validates tag identifiers and falls back safely on invalid or duplicate parameters", () => {
    expect(parseLeadSearchParams({ q: "Acme", status: "qualified", tagId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6" })).toMatchObject({
      q: "Acme", status: "qualified", tagId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6",
    });
    expect(parseLeadSearchParams({ tagId: "not-a-uuid" }).tagId).toBe("");
    expect(parseLeadSearchParams({ q: ["one", "two"], status: "converted", page: "0" })).toEqual({
      q: "", status: "all", sourceId: "", ownerId: "", tagId: "", page: 1, sort: "updated_desc",
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
