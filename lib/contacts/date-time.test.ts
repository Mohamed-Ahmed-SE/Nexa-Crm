import { describe, expect, it } from "vitest";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";

describe("normalizeContactDateTime", () => {
  it.each([
    ["2026-04-03T10:30", "420", "2026-04-03T17:30:00.000Z"],
    ["2026-04-03T10:30", "-240", "2026-04-03T06:30:00.000Z"],
  ])("converts a local time with browser offset %s %s", (localTime, timezoneOffset, expectedUtc) => {
    expect(normalizeContactDateTime(localTime, timezoneOffset)).toBe(expectedUtc);
  });

  it("preserves invalid local values and explicit timestamps for schema validation", () => {
    expect(normalizeContactDateTime("2026-04-03T10:30", "900")).toBe("2026-04-03T10:30");
    expect(normalizeContactDateTime("2026-04-03T10:30", "")).toBe("2026-04-03T10:30");
    expect(normalizeContactDateTime("2026-04-03T10:30:00.000Z", "420")).toBe("2026-04-03T10:30:00.000Z");
  });
});
