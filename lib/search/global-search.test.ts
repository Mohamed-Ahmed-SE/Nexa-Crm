import { describe, expect, it } from "vitest";
import { globalSearchFilters, parseGlobalSearchInput } from "@/lib/search/global-search";

describe("global search input and filters", () => {
  it("trims valid input and rejects blank or overlong queries", () => {
    expect(parseGlobalSearchInput("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(parseGlobalSearchInput("   ")).toBeNull();
    expect(parseGlobalSearchInput("x".repeat(101))).toBeNull();
    expect(parseGlobalSearchInput({ query: "Ada" })).toBeNull();
  });

  it("escapes PostgREST filter metacharacters via the entity builders", () => {
    const filters = globalSearchFilters('  50%_"\\  ');
    expect(filters.leads).toContain('50\\%\\_\\"\\\\');
    expect(filters.contacts).toContain('50\\%\\_\\"\\\\');
    expect(filters.companies).toContain('50\\%\\_\\"\\\\');
    expect(filters.deals).toContain('50\\%\\_\\"\\\\');
  });
});
