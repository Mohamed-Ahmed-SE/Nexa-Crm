import { describe, expect, it } from "vitest";
import { applyContactSavedView, parseContactSearchParams } from "@/lib/contacts/schema";

describe("Contacts page saved-view selection", () => {
  it("overlays saved filters and sort without resetting the requested page", () => {
    const params = parseContactSearchParams({ view: "view-id", page: "2", q: "untrusted-url-filter", sort: "created_asc" });
    const view = {
      filters: { q: "Acme", lifecycle: "customer" as const, companyId: "", ownerId: "unassigned" },
      sort: "name_desc" as const,
    };

    expect(applyContactSavedView(params, view)).toEqual({
      q: "Acme", lifecycle: "customer", companyId: "", ownerId: "unassigned", sort: "name_desc", page: 2,
    });
  });
});
