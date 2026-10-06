import { describe, expect, it } from "vitest";
import { canRetainArchivedCompany, contactCanBeEdited, isRetainingRelation } from "@/lib/contacts/relations";

describe("contact relationship and edit rules", () => {
  it("allows retaining only the same non-null relation", () => {
    expect(isRetainingRelation("current", "current")).toBe(true);
    expect(canRetainArchivedCompany("current-company", "current-company")).toBe(true);
    expect(canRetainArchivedCompany("other-company", "current-company")).toBe(false);
    expect(canRetainArchivedCompany(null, "current-company")).toBe(false);
    expect(canRetainArchivedCompany(null, null)).toBe(false);
  });

  it("limits member edits to assigned contacts while managers may edit all", () => {
    expect(contactCanBeEdited(false, "user-1", "user-1")).toBe(true);
    expect(contactCanBeEdited(false, "user-2", "user-1")).toBe(false);
    expect(contactCanBeEdited(false, null, "user-1")).toBe(false);
    expect(contactCanBeEdited(true, null, "user-1")).toBe(true);
  });
});
