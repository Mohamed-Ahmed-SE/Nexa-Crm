import { describe, expect, it } from "vitest";
import { parseTaskSearchParams, taskDateBounds } from "./schema";

describe("task query parsing", () => {
  it("defaults to My Tasks and normalizes supplied filters", () => {
    expect(parseTaskSearchParams({})).toEqual({ view: "my", q: "", priority: "all", type: "all", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: "overdue", q: " call ", type: "call", priority: "high", page: "3" })).toEqual({ view: "overdue", q: "call", type: "call", priority: "high", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 3 });
  });
  it("falls back safely for invalid and repeated query parameters", () => {
    expect(parseTaskSearchParams({ view: "today", page: "0" })).toEqual({ view: "my", q: "", priority: "all", type: "all", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: ["today", "completed"], q: ["x"] }).view).toBe("my");
    expect(parseTaskSearchParams({ view: "today", timezoneOffset: "900" })).toMatchObject({ view: "today", timezoneOffset: 0 });
  });
  it("calculates user-local day boundaries across a daylight-saving offset change", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    expect(taskDateBounds(now, 300, 240)).toEqual({ start: new Date("2026-03-08T05:00:00.000Z"), tomorrow: new Date("2026-03-09T04:00:00.000Z") });
  });
});

