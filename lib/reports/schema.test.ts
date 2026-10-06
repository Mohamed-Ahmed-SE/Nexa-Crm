import { describe, expect, it } from "vitest";
import { nextUtcDate, parseReportFilters } from "@/lib/reports/schema";

const now = new Date("2025-04-30T17:00:00.000Z");

describe("report query filters", () => {
  it("uses a bounded 90-day UTC range and upper-exclusive next-day boundary", () => {
    const filters = parseReportFilters({}, now);
    expect(filters).toMatchObject({ start: "2025-01-31", end: "2025-04-30", invalid: false });
    expect(nextUtcDate(filters.end)).toBe("2025-05-01T00:00:00.000Z");
  });

  it("rejects malformed and overlong ranges without passing them to the database", () => {
    expect(parseReportFilters({ start: "not-a-date", owner: "not-a-uuid" }, now)).toMatchObject({ invalid: true, ownerId: "all" });
    expect(parseReportFilters({ start: ["2025-01-01", "2025-01-02"] }, now).invalid).toBe(true);
    expect(parseReportFilters({ start: "2024-01-01", end: "2025-04-30" }, now).invalid).toBe(true);
    expect(parseReportFilters({ start: "2025-05-01", end: "2025-04-30" }, now).invalid).toBe(true);
  });
});
