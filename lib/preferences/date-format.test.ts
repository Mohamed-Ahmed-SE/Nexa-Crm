import { describe, expect, it } from "vitest";
import { DEFAULT_DATE_FORMAT, DATE_FORMATS, formatCalendarDate, formatCalendarDateTime, isDateFormat, normalizeDateFormat } from "@/lib/preferences/date-format";
import { dateFormatSchema } from "@/lib/preferences/schema";

describe("date format preferences", () => {
  it("supports only the three persisted choices and defaults invalid values", () => {
    expect(DATE_FORMATS).toEqual(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
    expect(DEFAULT_DATE_FORMAT).toBe("MM/DD/YYYY");
    for (const format of DATE_FORMATS) {
      expect(isDateFormat(format)).toBe(true);
      expect(dateFormatSchema.parse(format)).toBe(format);
      expect(normalizeDateFormat(format)).toBe(format);
    }
    expect(dateFormatSchema.safeParse("YYYY/MM/DD").success).toBe(false);
    expect(normalizeDateFormat(null)).toBe(DEFAULT_DATE_FORMAT);
  });

  it.each([
    ["MM/DD/YYYY", "04/05/2026"],
    ["DD/MM/YYYY", "05/04/2026"],
    ["YYYY-MM-DD", "2026-04-05"],
  ] as const)("formats calendar dates as %s", (format, expected) => {
    expect(formatCalendarDate("2026-04-05", format)).toBe(expected);
    expect(formatCalendarDate("2026-04-05T00:30:00Z", format, { timeZone: "UTC" })).toBe(expected);
  });

  it("keeps date-only values stable regardless of local timezone", () => {
    expect(formatCalendarDate("2026-04-05", "DD/MM/YYYY", { timeZone: "America/Los_Angeles" })).toBe("05/04/2026");
  });

  it("formats timestamps with the requested date order and preserves time zone", () => {
    expect(formatCalendarDateTime("2026-04-05T15:07:00Z", "YYYY-MM-DD", "UTC")).toBe("2026-04-05, 3:07 PM");
  });
});
