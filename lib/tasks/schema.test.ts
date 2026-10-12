import { describe, expect, it } from "vitest";
import { parseTaskSearchParams, restrictAllTasksView, taskDateBounds, taskWeekBounds } from "./schema";

describe("task query parsing", () => {
  it("defaults to My Tasks and normalizes supplied filters", () => {
    expect(parseTaskSearchParams({})).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: "overdue", q: " call ", type: "call", priority: "high", sort: "title", page: "3" })).toEqual({ view: "overdue", q: "call", type: "call", priority: "high", sort: "title", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, page: 3 });
  });
  it("restricts All Tasks to My Tasks and preserves other views", () => {
    const allTasks = parseTaskSearchParams({ view: "all", q: "proposal", sort: "title", page: "2" });
    expect(restrictAllTasksView(allTasks)).toEqual({ ...allTasks, view: "my" });
    const todayTasks = parseTaskSearchParams({ view: "today" });
    expect(restrictAllTasksView(todayTasks)).toEqual(todayTasks);
  });
  it("falls back safely for invalid and repeated query parameters", () => {
    expect(parseTaskSearchParams({ view: "today", page: "0" })).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: ["today", "completed"], q: ["x"] }).view).toBe("my");
    expect(parseTaskSearchParams({ sort: "created_at" })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ sort: ["title", "due_date"] })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ view: "today", timezoneOffset: "900" })).toMatchObject({ view: "today", timezoneOffset: 0 });
  });
  it("calculates user-local day boundaries across a daylight-saving offset change", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    expect(taskDateBounds(now, 300, 240)).toEqual({ start: new Date("2026-03-08T05:00:00.000Z"), tomorrow: new Date("2026-03-09T04:00:00.000Z") });
  });
  it.each([
    { label: "week containing a daylight-saving transition", now: "2026-03-04T12:00:00.000Z", offset: 300, weekStartOffset: 300, nextWeekOffset: 240, start: "2026-03-02T05:00:00.000Z", end: "2026-03-09T04:00:00.000Z" },
    { label: "midweek in daylight time", now: "2026-04-08T12:00:00.000Z", offset: 240, weekStartOffset: 240, nextWeekOffset: 240, start: "2026-04-06T04:00:00.000Z", end: "2026-04-13T04:00:00.000Z" },
  ])("uses Monday-inclusive and next-Monday-exclusive week bounds for a $label", ({ now, offset, weekStartOffset, nextWeekOffset, start, end }) => {
    expect(taskWeekBounds(new Date(now), offset, weekStartOffset, nextWeekOffset)).toEqual({ start: new Date(start), end: new Date(end) });
  });
});

