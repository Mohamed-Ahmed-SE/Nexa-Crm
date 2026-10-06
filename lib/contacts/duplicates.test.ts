import { describe, expect, it } from "vitest";
import { findContactDuplicates, normalizeContactEmail, normalizeContactPhone, type ContactDuplicateCandidate } from "./duplicates";

const candidate: ContactDuplicateCandidate = {
  first_name: "Sam",
  last_name: "Rivera",
  email: "sam@example.test",
  phone: "+1 415 555 0100",
  companies: { name: "Acme" },
};

describe("contact duplicate matching", () => {
  it.each([
    ["trimmed, case-insensitive email", normalizeContactEmail("  SAM@Example.Test  "), ""],
    ["phone digits only", "", normalizeContactPhone("(1) 415-555-0100")],
  ])("matches %s without returning contact details", (_scenario, email, phone) => {
    expect(findContactDuplicates([candidate], email, phone)).toEqual([
      { name: "Sam Rivera", companyName: "Acme" },
    ]);
  });

  it("does not match blank input values", () => {
    expect(findContactDuplicates([candidate], "", "")).toEqual([]);
    expect(normalizeContactPhone("(+---) ")).toBe("");
    expect(normalizeContactEmail("   ")).toBe("");
  });

  it("returns one safe match when both details match", () => {
    expect(findContactDuplicates([candidate], "sam@example.test", "14155550100")).toEqual([
      { name: "Sam Rivera", companyName: "Acme" },
    ]);
  });
});
