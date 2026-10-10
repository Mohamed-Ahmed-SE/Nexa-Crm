import { describe, expect, it } from "vitest";
import { findLeadDuplicates, normalizeLeadEmail, normalizeLeadPhone, type LeadDuplicateCandidate } from "./duplicates";

const candidate: LeadDuplicateCandidate = {
  id: "lead-1",
  full_name: "Taylor Reed",
  email: "taylor@example.test",
  phone: "+1 (415) 555-0100",
};

describe("lead duplicate matching", () => {
  it("matches email after trimming surrounding space and ignoring case", () => {
    expect(normalizeLeadEmail("  TAYLOR@Example.Test  ")).toBe("taylor@example.test");
    expect(findLeadDuplicates([candidate], normalizeLeadEmail(" TAYLOR@example.test "), "")).toEqual([candidate]);
  });

  it("matches phone using digits only", () => {
    expect(normalizeLeadPhone("(+1) 415-555-0100")).toBe("14155550100");
    expect(findLeadDuplicates([candidate], "", normalizeLeadPhone("+1 415.555.0100"))).toEqual([candidate]);
  });

  it("matches either supplied identifier", () => {
    const emailOnlyMatch = { ...candidate, phone: null };
    const phoneOnlyMatch = { ...candidate, id: "lead-2", email: null };

    expect(findLeadDuplicates([emailOnlyMatch, phoneOnlyMatch], "taylor@example.test", "14155550100"))
      .toEqual([emailOnlyMatch, phoneOnlyMatch]);
  });

  it("ignores empty input and candidate identifiers", () => {
    const emptyCandidate = { ...candidate, email: "   ", phone: "(+---)" };

    expect(findLeadDuplicates([emptyCandidate, candidate], "", "")).toEqual([]);
    expect(normalizeLeadEmail("   ")).toBe("");
    expect(normalizeLeadPhone("(+---)")).toBe("");
  });
});
