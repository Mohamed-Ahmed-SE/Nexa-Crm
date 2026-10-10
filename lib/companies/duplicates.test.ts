import { describe, expect, it } from "vitest";
import { findCompanyDuplicates, normalizeCompanyHostname, normalizeCompanyName, type CompanyDuplicateCandidate } from "./duplicates";

const candidates: CompanyDuplicateCandidate[] = [
  { id: "name-match", name: "Café & Co., Inc.", website: null },
  { id: "domain-match", name: "A different name", website: "http://www.example.com/about" },
  { id: "unrelated", name: "Other Company", website: "https://other.example" },
];

describe("company duplicate matching", () => {
  it.each([
    ["  CAFÉ   & Co., Inc. ", "cafe co inc"],
    ["Example.COM.", "example com"],
  ])("normalizes company text consistently: %s", (source, expected) => {
    expect(normalizeCompanyName(source)).toBe(expected);
  });

  it("matches the same website hostname across protocol, www, and path differences", () => {
    expect(normalizeCompanyHostname("https://example.com/contact")).toBe("example.com");
    expect(findCompanyDuplicates(candidates, "New Company", "https://example.com")).toEqual([candidates[1]]);
  });

  it("matches names without requiring a website and ignores absent website signals", () => {
    expect(findCompanyDuplicates(candidates, "cafe & co inc", null)).toEqual([candidates[0]]);
    expect(findCompanyDuplicates(candidates, "New Company", null)).toEqual([]);
  });
});
