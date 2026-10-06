import { describe, expect, it } from "vitest";
import { shapeWorkspaceDashboard } from "@/lib/dashboard/presentation";
import type { WorkspaceDashboardData } from "@/lib/dashboard/types";

const dashboardFixture: WorkspaceDashboardData = {
  currency: "USD",
  timeZone: "UTC",
  today: "2026-04-15",
  stages: [
    { id: "stage-open", name: "Discovery", pipelineId: "pipeline-main", pipelineName: "Sales", position: 1, stageType: "open" },
    { id: "stage-won", name: "Won", pipelineId: "pipeline-main", pipelineName: "Sales", position: 2, stageType: "won" },
  ],
  deals: [
    { id: "open-1", title: "Open current", company: "Northstar", contact: "Alex Chen", stage: "Discovery", stageId: "stage-open", pipelineId: "pipeline-main", stageType: "open", amount: 1200, currency: "USD", owner: "Sam", expectedCloseDate: "2026-04-20", createdAt: "2026-04-01T00:00:00.000Z", lastActivityAt: "2026-04-14T00:00:00.000Z", wonAt: null, source: "Referral", status: "open" },
    { id: "stale", title: "Stale open", company: null, contact: null, stage: "Discovery", stageId: "stage-open", pipelineId: "pipeline-main", stageType: "open", amount: 800, currency: "USD", owner: "Unassigned", expectedCloseDate: "2026-04-30", createdAt: "2026-03-01T00:00:00.000Z", lastActivityAt: null, wonAt: null, source: "Referral", status: "open" },
    { id: "past-close", title: "Past close", company: null, contact: null, stage: "Discovery", stageId: "stage-open", pipelineId: "pipeline-main", stageType: "open", amount: 300, currency: "USD", owner: "Sam", expectedCloseDate: "2026-04-14", createdAt: "2026-04-01T00:00:00.000Z", lastActivityAt: "2026-04-14T00:00:00.000Z", wonAt: null, source: "Web", status: "open" },
    { id: "won-this-month", title: "Won", company: null, contact: null, stage: "Won", stageId: "stage-won", pipelineId: "pipeline-main", stageType: "won", amount: 5000, currency: "USD", owner: "Sam", expectedCloseDate: null, createdAt: "2026-03-01T00:00:00.000Z", lastActivityAt: null, wonAt: "2026-04-05T00:00:00.000Z", source: "Referral", status: "won" },
    { id: "other-currency", title: "EUR deal", company: null, contact: null, stage: "Discovery", stageId: "stage-open", pipelineId: "pipeline-main", stageType: "open", amount: 99999, currency: "EUR", owner: "Sam", expectedCloseDate: "2026-04-20", createdAt: "2026-04-01T00:00:00.000Z", lastActivityAt: null, wonAt: null, source: "Other", status: "open" },
  ],
  leads: [
    { id: "lead-apr", createdAt: "2026-04-02T10:00:00.000Z", source: "Web" },
    { id: "lead-mar", createdAt: "2026-03-31T23:59:59.000Z", source: "Email" },
  ],
  tasks: [
    { id: "today-task", title: "Call today", dueAt: "2026-04-15T16:00:00.000Z", priority: "high", relatedTo: "Open current", relatedId: "open-1", relatedHref: "/app/deals/open-1" },
    { id: "overdue", title: "Late task", dueAt: "2026-04-14T16:00:00.000Z", priority: "medium", relatedTo: null, relatedId: null, relatedHref: null },
  ],
  activities: [],
};

const now = new Date("2026-04-15T12:00:00.000Z");

describe("shapeWorkspaceDashboard", () => {
  it("calculates truthful workspace metrics and operational lists", () => {
    const dashboardSummary = shapeWorkspaceDashboard(dashboardFixture, now);
    expect(dashboardSummary.pipelineValue).toBe(2300);
    expect(dashboardSummary.openDeals).toBe(4);
    expect(dashboardSummary.newLeads).toBe(1);
    expect(dashboardSummary.wonRevenue).toBe(5000);
    expect(dashboardSummary.overdueTasks).toBe(1);
    expect(dashboardSummary.closingThisMonth).toBe(4);
    expect(dashboardSummary.pipelineByStage).toEqual([{ id: "stage-open", name: "Discovery", pipelineName: "Sales", count: 4, value: 2300 }]);
    expect(dashboardSummary.dealsBySource).toEqual([{ name: "Referral", count: 3 }, { name: "Web", count: 1 }, { name: "Other", count: 1 }]);
    expect(dashboardSummary.tasksToday.map(({ id }) => id)).toEqual(["today-task"]);
    expect(dashboardSummary.attentionDeals.map(({ deal }) => deal.id)).toEqual(["past-close", "other-currency", "stale"]);
  });

  // Cases: one second before local month/day starts, exact local day starts, the final second before next day, and the exact next-day boundary catch DST off-by-one errors.
  it("uses workspace-local boundaries for today and month totals", () => {
    const localDashboard = {
      ...dashboardFixture,
      timeZone: "America/Los_Angeles",
      leads: [...dashboardFixture.leads, { id: "lead-before-local-month", createdAt: "2026-04-01T06:59:59.000Z", source: "Web" }],
      tasks: [
        ...dashboardFixture.tasks,
        { id: "before-local-day", title: "Before local day", dueAt: "2026-04-15T06:59:59.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
        { id: "local-day-start", title: "Local day start", dueAt: "2026-04-15T07:00:00.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
        { id: "next-local-day", title: "Next local day", dueAt: "2026-04-16T07:00:00.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
      ],
    };
    const dashboardSummary = shapeWorkspaceDashboard(localDashboard, now);
    expect(dashboardSummary.newLeads).toBe(1);
    expect(dashboardSummary.tasksToday.map(({ id }) => id)).toEqual(["local-day-start", "today-task"]);
  });

  it("uses a 23-hour workspace day when daylight saving time begins", () => {
    const dstDashboard = {
      ...dashboardFixture,
      timeZone: "America/Los_Angeles",
      today: "2026-03-08",
      tasks: [
        { id: "before-dst-day", title: "Before DST day", dueAt: "2026-03-08T07:59:59.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
        { id: "dst-day-start", title: "DST day start", dueAt: "2026-03-08T08:00:00.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
        { id: "before-next-day", title: "Before next day", dueAt: "2026-03-09T06:59:59.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
        { id: "next-day-start", title: "Next day start", dueAt: "2026-03-09T07:00:00.000Z", priority: "low", relatedTo: null, relatedId: null, relatedHref: null },
      ],
    };
    const dashboardSummary = shapeWorkspaceDashboard(dstDashboard, new Date("2026-03-08T12:00:00.000Z"));
    expect(dashboardSummary.tasksToday.map(({ id }) => id)).toEqual(["dst-day-start", "before-next-day"]);
  });

  it("returns honest zeros and empty collections for a workspace with no records", () => {
    const emptySummary = shapeWorkspaceDashboard({ ...dashboardFixture, deals: [], leads: [], tasks: [], activities: [] }, now);
    expect(emptySummary).toMatchObject({ pipelineValue: 0, openDeals: 0, newLeads: 0, wonRevenue: 0, overdueTasks: 0, closingThisMonth: 0, tasksToday: [], attentionDeals: [], dealsBySource: [] });
    expect(emptySummary.pipelineByStage).toEqual([{ id: "stage-open", name: "Discovery", pipelineName: "Sales", count: 0, value: 0 }]);
  });
});
