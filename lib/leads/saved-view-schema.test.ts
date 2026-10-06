import { describe, expect, it } from "vitest";
import { leadSavedViewSchema, parsePersistedLeadView } from "@/lib/leads/saved-view-schema";

const validView = {
  name: "  Qualified prospects ",
  filters: { q: "Acme", status: "qualified", sourceId: "", ownerId: "unassigned" },
  sort: "value_desc",
  visibleColumns: ["name", "status", "value"],
};

describe("saved lead view validation", () => {
  it("normalizes names and accepts only supported saved list state", () => {
    expect(leadSavedViewSchema.parse(validView)).toMatchObject({ name: "Qualified prospects", sort: "value_desc" });
  });

  it("rejects arbitrary columns, operators, duplicate or empty visible columns", () => {
    expect(leadSavedViewSchema.safeParse({ ...validView, sort: "id_desc" }).success).toBe(false);
    expect(leadSavedViewSchema.safeParse({ ...validView, filters: { ...validView.filters, status: "qualified,or(id.gt.0)" } }).success).toBe(false);
    expect(leadSavedViewSchema.safeParse({ ...validView, visibleColumns: ["name", "private_notes"] }).success).toBe(false);
    expect(leadSavedViewSchema.safeParse({ ...validView, visibleColumns: ["name", "name"] }).success).toBe(false);
    expect(leadSavedViewSchema.safeParse({ ...validView, visibleColumns: [] }).success).toBe(false);
  });

  it("refuses malformed persisted JSON instead of using it as query state", () => {
    expect(parsePersistedLeadView({ filters: { status: "qualified", operator: "or" }, sort: "id_desc", visible_columns: ["name"] })).toBeNull();
    expect(parsePersistedLeadView({ filters: validView.filters, sort: validView.sort, visible_columns: validView.visibleColumns })).toEqual({
      filters: validView.filters, sort: validView.sort, visibleColumns: validView.visibleColumns,
    });
  });
});
