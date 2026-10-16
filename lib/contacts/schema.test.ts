import { describe, expect, it } from "vitest";
import { buildContactSearchFilter, contactInputSchema, contactSavedViewSchema, contactSortOrder, parseContactSearchParams, parsePersistedContactView } from "@/lib/contacts/schema";

const uuid = "83d8aaf1-c78e-41db-ae18-493f44c84b42";
const otherUuid = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

describe("contactInputSchema", () => {
  it("requires valid names and normalizes optional blanks", () => {
    expect(contactInputSchema.safeParse({ firstName: " ", lastName: "Chen", lifecycleStatus: "active" }).success).toBe(false);
    expect(contactInputSchema.parse({ firstName: " Sarah ", lastName: " Chen ", lifecycleStatus: "customer", email: "", companyId: "" })).toMatchObject({
      firstName: "Sarah", lastName: "Chen", email: null, companyId: null, ownerId: null, phone: null, address: null, tagIds: [],
    });
  });

  it("accepts a unique list of UUID tag IDs and rejects malformed or repeated IDs", () => {
    const base = { firstName: "A", lastName: "B", lifecycleStatus: "active" } as const;
    expect(contactInputSchema.safeParse({ ...base, tagIds: [uuid, otherUuid] }).success).toBe(true);
    expect(contactInputSchema.safeParse({ ...base, tagIds: ["not-a-uuid"] }).success).toBe(false);
    expect(contactInputSchema.safeParse({ ...base, tagIds: [uuid, uuid] }).success).toBe(false);
    expect(contactInputSchema.safeParse({ ...base, tagIds: Array(101).fill(uuid) }).success).toBe(false);
  });

  it("trims multiline addresses, normalizes blanks, and enforces the 500-character limit", () => {
    expect(contactInputSchema.parse({ firstName: "A", lastName: "B", lifecycleStatus: "active", address: "  12 Market St\nSuite 4  " }).address).toBe("12 Market St\nSuite 4");
    expect(contactInputSchema.parse({ firstName: "A", lastName: "B", lifecycleStatus: "active", address: "  \t " }).address).toBeNull();
    expect(contactInputSchema.safeParse({ firstName: "A", lastName: "B", lifecycleStatus: "active", address: "x".repeat(501) }).success).toBe(false);
    expect(contactInputSchema.parse({ firstName: "A", lastName: "B", lifecycleStatus: "active", address: "x".repeat(500) }).address).toHaveLength(500);
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
      q: "Chen", lifecycle: "customer", companyId: uuid, ownerId: "unassigned", tagId: "", sort: "name_asc", page: 3,
    });
    expect(parseContactSearchParams({ q: "x".repeat(101), lifecycle: "unknown", company: "other", owner: "other", page: "0" })).toEqual({
      q: "", lifecycle: "all", companyId: "", ownerId: "", tagId: "", sort: "updated_desc", page: 1,
    });
  });

  it("accepts a valid tag filter and discards a malformed one", () => {
    expect(parseContactSearchParams({ tagId: uuid })).toMatchObject({ tagId: uuid });
    expect(parseContactSearchParams({ tagId: "not-a-uuid" })).toMatchObject({ tagId: "" });
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
