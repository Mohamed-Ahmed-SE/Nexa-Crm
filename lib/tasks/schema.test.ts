import { describe, expect, it } from "vitest";
import { parseTaskSearchParams, restrictAllTasksView, taskDateBounds, taskLocalDateBounds, taskWeekBounds } from "./schema";

describe("task query parsing", () => {
  it("defaults to My Tasks and normalizes supplied filters", () => {
    expect(parseTaskSearchParams({})).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, timeZone: "UTC", page: 1 });
    expect(parseTaskSearchParams({ view: "overdue", q: " call ", type: "call", priority: "high", sort: "title", page: "3" })).toEqual({ view: "overdue", q: "call", type: "call", priority: "high", sort: "title", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, timeZone: "UTC", page: 3 });
  });
  it("restricts All Tasks to My Tasks and preserves other views", () => {
    const allTasks = parseTaskSearchParams({ view: "all", q: "proposal", sort: "title", page: "2" });
    expect(restrictAllTasksView(allTasks)).toEqual({ ...allTasks, view: "my" });
    const todayTasks = parseTaskSearchParams({ view: "today" });
    expect(restrictAllTasksView(todayTasks)).toEqual(todayTasks);
    const cancelledTasks = parseTaskSearchParams({ view: "cancelled" });
    expect(cancelledTasks.view).toBe("cancelled");
    expect(restrictAllTasksView(cancelledTasks)).toEqual(cancelledTasks);
  });
  it("falls back safely for invalid and repeated query parameters", () => {
    expect(parseTaskSearchParams({ view: "today", page: "0" })).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, timeZone: "UTC", page: 1 });
    expect(parseTaskSearchParams({ view: ["today", "completed"], q: ["x"] }).view).toBe("my");
    expect(parseTaskSearchParams({ sort: "created_at" })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ sort: ["title", "due_date"] })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ view: "today", timezoneOffset: "900" })).toMatchObject({ view: "today", timezoneOffset: 0 });
  });
  it("preserves a valid selected date, calendar month, and IANA timezone in URL state", () => {
    expect(parseTaskSearchParams({ view: "upcoming", q: "proposal", type: "email", priority: "high", sort: "title", date: "2026-03-08", calendarMonth: "2026-03", timeZone: "America/New_York", page: "4" })).toMatchObject({ view: "upcoming", q: "proposal", type: "email", priority: "high", sort: "title", date: "2026-03-08", calendarMonth: "2026-03", timeZone: "America/New_York", page: 4 });
    expect(parseTaskSearchParams({ view: "overdue", q: "keep this", date: "2026-02-30" })).toMatchObject({ view: "overdue", q: "keep this", date: undefined });
    expect(parseTaskSearchParams({ date: "2026-03-08", timeZone: "Invalid/Zone" })).toMatchObject({ view: "my", timeZone: "UTC" });
  });
  it.each([
    { label: "spring-forward day", date: "2026-03-08", start: "2026-03-08T05:00:00.000Z", end: "2026-03-09T04:00:00.000Z" },
    { label: "fall-back day", date: "2026-11-01", start: "2026-11-01T04:00:00.000Z", end: "2026-11-02T05:00:00.000Z" },
  ])("calculates IANA-local date bounds for the $label", ({ date, start, end }) => {
    expect(taskLocalDateBounds(date, "America/New_York")).toEqual({ start: new Date(start), end: new Date(end) });
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

