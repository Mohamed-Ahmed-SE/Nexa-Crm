import { describe, expect, it } from "vitest";
import { applyCompanySavedView, buildCompanySearchFilter, companyInputSchema, companySavedViewSchema, companySortOrder, findCompanySavedView, parseCompanySearchParams, parsePersistedCompanyView, type CompanySavedViewInput } from "@/lib/companies/schema";

const ownerId = "83d8aaf1-c78e-41db-ae18-493f44c84b42";
const otherTagId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

describe("company input", () => {
  it.each([
    { scenario: "blank optional fields", input: { name: " Acme ", website: "", industry: "", employeeSize: "", ownerId: "" }, expected: { name: "Acme", website: null, industry: null, employeeSize: null, ownerId: null, phone: null, tagIds: [] } },
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

  it("accepts a unique list of UUID tag IDs and rejects malformed or repeated IDs", () => {
    const base = { name: "Acme" };
    expect(companyInputSchema.safeParse({ ...base, tagIds: [ownerId, otherTagId] }).success).toBe(true);
    expect(companyInputSchema.safeParse({ ...base, tagIds: ["not-a-uuid"] }).success).toBe(false);
    expect(companyInputSchema.safeParse({ ...base, tagIds: [ownerId, ownerId] }).success).toBe(false);
  });
});

describe("company list query", () => {
  it.each([
    { scenario: "valid search parameters", input: { q: " Acme ", owner: ownerId, sort: "industry_desc", page: "4" }, expected: { q: "Acme", ownerId, tagId: "", sort: "industry_desc", page: 4 } },
    { scenario: "invalid parameter groups", input: { q: "x".repeat(101), owner: "forged", sort: "secret", page: "0" }, expected: { q: "", ownerId: "", tagId: "", sort: "name_asc", page: 1 } },
  ])("parses $scenario", ({ input, expected }) => {
    expect(parseCompanySearchParams(input)).toEqual(expected);
  });

  it("accepts a valid tag filter and discards a malformed one", () => {
    expect(parseCompanySearchParams({ tagId: ownerId })).toMatchObject({ tagId: ownerId });
    expect(parseCompanySearchParams({ tagId: "not-a-uuid" })).toMatchObject({ tagId: "" });
  });

  it.each([
    ["escaped wildcard syntax", 'Acme%_"', 'name.ilike."%Acme\\%\\_\\\"%",industry.ilike."%Acme\\%\\_\\\"%",website.ilike."%Acme\\%\\_\\\"%",phone.ilike."%Acme\\%\\_\\\"%"'],
    ["blank queries", "  ", null],
  ])("builds company search filters for %s", (_scenario, query, expected) => {
    expect(buildCompanySearchFilter(query)).toBe(expected);
  });
});

describe("company saved views", () => {
  const view: CompanySavedViewInput = { name: "Accounts", filters: { q: "Acme", ownerId }, sort: "industry_desc", visibleColumns: ["company", "owner"] };

  it("applies the saved company filters and sort while preserving pagination", () => {
    expect(applyCompanySavedView({ q: "URL", ownerId: "", tagId: "", sort: "name_asc", page: 3 }, view)).toEqual({
      q: "Acme", ownerId, tagId: "", sort: "industry_desc", page: 3,
    });
  });

  it("resolves only valid IDs present in the caller's saved-view list", () => {
    const views = [{ id: "83d8aaf1-c78e-41db-ae18-493f44c84b42" }];
    expect(findCompanySavedView(views[0].id, views)).toBe(views[0]);
    expect(findCompanySavedView("not-a-view", views)).toBeUndefined();
    expect(findCompanySavedView("d8d8aaf1-c78e-41db-ae18-493f44c84b42", views)).toBeUndefined();
  });

  it("validates selected columns and rejects malformed persisted view data", () => {
    expect(companySavedViewSchema.parse(view)).toMatchObject({ name: "Accounts", sort: "industry_desc" });
    expect(companySavedViewSchema.safeParse({ ...view, sort: "website_desc" }).success).toBe(false);
    expect(companySavedViewSchema.safeParse({ ...view, visibleColumns: ["company", "company"] }).success).toBe(false);
    expect(parsePersistedCompanyView({ filters: { q: "Acme", ownerId: "", extra: true }, sort: view.sort, visible_columns: view.visibleColumns })).toBeNull();
    expect(parsePersistedCompanyView({ filters: view.filters, sort: view.sort, visible_columns: view.visibleColumns })).toEqual({ filters: view.filters, sort: view.sort, visibleColumns: view.visibleColumns });
  });

  it.each([
    ["name_desc", [{ column: "name", ascending: false }, { column: "id", ascending: true }]],
    ["industry_asc", [{ column: "industry", ascending: true }, { column: "id", ascending: true }]],
    ["created_desc", [{ column: "created_at", ascending: false }, { column: "id", ascending: true }]],
    ["updated_asc", [{ column: "updated_at", ascending: true }, { column: "id", ascending: true }]],
  ] as const)("uses a stable tie-breaker for %s sorting", (sort, expected) => {
    expect(companySortOrder(sort)).toEqual(expected);
  });
});
