import { describe, expect, it } from "vitest";
import { buildCompanySearchFilter, companyInputSchema, parseCompanySearchParams } from "@/lib/companies/schema";

const ownerId = "83d8aaf1-c78e-41db-ae18-493f44c84b42";

describe("company input", () => {
  it.each([
    { scenario: "blank optional fields", input: { name: " Acme ", website: "", industry: "", employeeSize: "", ownerId: "" }, expected: { name: "Acme", website: null, industry: null, employeeSize: null, ownerId: null, phone: null } },
    { scenario: "employee count and owner", input: { name: "Acme", employeeSize: "42", ownerId }, expected: { employeeSize: 42, ownerId } },
  ])("normalizes $scenario", ({ input, expected }) => {
    expect(companyInputSchema.parse(input)).toMatchObject(expected);
  });

  it.each([
    ["blank name", { name: "  ", employeeSize: "-1" }],
    ["invalid owner ID", { name: "Acme", ownerId: "not-a-uuid" }],
    ["unsafe website protocol", { name: "Acme", website: "javascript:alert(1)" }],
  ])("rejects %s", (_scenario, input) => {
    expect(companyInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("company list query", () => {
  it.each([
    { scenario: "valid search parameters", input: { q: " Acme ", owner: ownerId, page: "4" }, expected: { q: "Acme", ownerId, page: 4 } },
    { scenario: "invalid parameter groups", input: { q: "x".repeat(101), owner: "forged", page: "0" }, expected: { q: "", ownerId: "", page: 1 } },
  ])("parses $scenario", ({ input, expected }) => {
    expect(parseCompanySearchParams(input)).toEqual(expected);
  });

  it.each([
    ["escaped wildcard syntax", 'Acme%_"', 'name.ilike."%Acme\\%\\_\\\"%",industry.ilike."%Acme\\%\\_\\\"%",website.ilike."%Acme\\%\\_\\\"%",phone.ilike."%Acme\\%\\_\\\"%"'],
    ["blank queries", "  ", null],
  ])("builds company search filters for %s", (_scenario, query, expected) => {
    expect(buildCompanySearchFilter(query)).toBe(expected);
  });
});
