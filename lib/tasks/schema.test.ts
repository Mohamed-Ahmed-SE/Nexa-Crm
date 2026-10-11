import { describe, expect, it } from "vitest";
import { parseTaskSearchParams, restrictAllTasksView, taskDateBounds } from "./schema";

describe("task query parsing", () => {
  it("defaults to My Tasks and normalizes supplied filters", () => {
    expect(parseTaskSearchParams({})).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: "overdue", q: " call ", type: "call", priority: "high", sort: "title", page: "3" })).toEqual({ view: "overdue", q: "call", type: "call", priority: "high", sort: "title", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 3 });
  });
  it("restricts All Tasks to My Tasks and preserves other views", () => {
    const allTasks = parseTaskSearchParams({ view: "all", q: "proposal", sort: "title", page: "2" });
    expect(restrictAllTasksView(allTasks)).toEqual({ ...allTasks, view: "my" });
    const todayTasks = parseTaskSearchParams({ view: "today" });
    expect(restrictAllTasksView(todayTasks)).toEqual(todayTasks);
  });
  it("falls back safely for invalid and repeated query parameters", () => {
    expect(parseTaskSearchParams({ view: "today", page: "0" })).toEqual({ view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 });
    expect(parseTaskSearchParams({ view: ["today", "completed"], q: ["x"] }).view).toBe("my");
    expect(parseTaskSearchParams({ sort: "created_at" })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ sort: ["title", "due_date"] })).toMatchObject({ view: "my", sort: "due_date" });
    expect(parseTaskSearchParams({ view: "today", timezoneOffset: "900" })).toMatchObject({ view: "today", timezoneOffset: 0 });
  });
  it("calculates user-local day boundaries across a daylight-saving offset change", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    expect(taskDateBounds(now, 300, 240)).toEqual({ start: new Date("2026-03-08T05:00:00.000Z"), tomorrow: new Date("2026-03-09T04:00:00.000Z") });
  });
});

