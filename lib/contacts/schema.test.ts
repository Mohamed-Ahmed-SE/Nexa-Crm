import { describe, expect, it } from "vitest";
import { buildContactSearchFilter, contactInputSchema, contactSavedViewSchema, contactSortOrder, parseContactSearchParams, parsePersistedContactView } from "@/lib/contacts/schema";

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
    expect(parseContactSearchParams({ q: " Chen ", lifecycle: "customer", company: uuid, owner: "unassigned", sort: "name_asc", page: "3" })).toEqual({
      q: "Chen", lifecycle: "customer", companyId: uuid, ownerId: "unassigned", sort: "name_asc", page: 3,
    });
    expect(parseContactSearchParams({ q: "x".repeat(101), lifecycle: "unknown", company: "other", owner: "other", page: "0" })).toEqual({
      q: "", lifecycle: "all", companyId: "", ownerId: "", sort: "updated_desc", page: 1,
    });
  });

  it.each([
    ["updated_desc", [{ column: "updated_at", ascending: false }, { column: "id", ascending: true }]],
    ["updated_asc", [{ column: "updated_at", ascending: true }, { column: "id", ascending: true }]],
    ["created_desc", [{ column: "created_at", ascending: false }, { column: "id", ascending: true }]],
    ["created_asc", [{ column: "created_at", ascending: true }, { column: "id", ascending: true }]],
    ["name_asc", [{ column: "first_name", ascending: true }, { column: "last_name", ascending: true }, { column: "id", ascending: true }]],
    ["name_desc", [{ column: "first_name", ascending: false }, { column: "last_name", ascending: false }, { column: "id", ascending: true }]],
  ] as const)("maps %s to deterministic database sort order", (sort, expected) => {
    expect(contactSortOrder(sort)).toEqual(expected);
  });

  it("escapes wildcard syntax and searches contact fields", () => {
    expect(buildContactSearchFilter('Chen%_"')).toBe('first_name.ilike."%Chen\\%\\_\\\"%",last_name.ilike."%Chen\\%\\_\\\"%",email.ilike."%Chen\\%\\_\\\"%",phone.ilike."%Chen\\%\\_\\\"%",job_title.ilike."%Chen\\%\\_\\\"%"');
    expect(buildContactSearchFilter("  ")).toBeNull();
  });
});

describe("contact saved view validation", () => {
  const view = { name: " Prospects ", filters: { q: "Acme", lifecycle: "active", companyId: uuid, ownerId: "unassigned" }, sort: "name_asc", visibleColumns: ["name", "lifecycle"] };

  it("normalizes the view name and accepts only Contacts list state", () => {
    expect(contactSavedViewSchema.parse(view)).toMatchObject({ name: "Prospects", sort: "name_asc" });
    expect(contactSavedViewSchema.safeParse({ ...view, filters: { ...view.filters, status: "active" } }).success).toBe(false);
    expect(contactSavedViewSchema.safeParse({ ...view, sort: "email_desc" }).success).toBe(false);
    expect(contactSavedViewSchema.safeParse({ ...view, visibleColumns: ["name", "name"] }).success).toBe(false);
  });

  it("rejects malformed persisted JSON without applying it to the list", () => {
    expect(parsePersistedContactView({ filters: { ...view.filters, operator: "or" }, sort: view.sort, visible_columns: view.visibleColumns })).toBeNull();
    expect(parsePersistedContactView({ filters: view.filters, sort: view.sort, visible_columns: ["name", "secret"] })).toBeNull();
    expect(parsePersistedContactView({ filters: view.filters, sort: view.sort, visible_columns: view.visibleColumns })).toEqual({
      filters: view.filters, sort: view.sort, visibleColumns: view.visibleColumns,
    });
  });
});
