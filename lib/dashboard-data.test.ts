import { describe, expect, it } from "vitest";
import { createDemoRecords, isInDateScope, isTaskOverdue, selectDashboard, selectDemoReports, type LeadStatus } from "@/lib/dashboard-data";

const fixtureDate = new Date("2025-04-15T12:00:00.000Z");

function calendarDayOffset(value: string, now: Date): number {
  const date = new Date(value);
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dateDay - nowDay) / 86400000);
}

describe("shared demo records and reports", () => {
  it("keeps the canonical fixture within the documented demo distributions", () => {
    const records = createDemoRecords(fixtureDate);
    const leadCounts = records.leads.reduce<Record<LeadStatus, number>>((counts, lead) => {
      counts[lead.status] += 1;
      return counts;
    }, { New: 0, Contacted: 0, Qualified: 0, Unqualified: 0 });
    const openDeals = records.deals.filter((deal) => deal.status === "open");
    const requiredSources = ["Website", "Referral", "LinkedIn", "Outbound", "Event"];
    const requiredIndustries = ["SaaS", "Real Estate", "Healthcare", "Ecommerce", "Logistics", "Education", "Hospitality", "Manufacturing"];

    expect(records.companies.length).toBeGreaterThanOrEqual(12);
    expect(records.companies.length).toBeLessThanOrEqual(18);
    expect(requiredIndustries.every((industry) => records.companies.some((company) => company.industry === industry))).toBe(true);
    expect(records.contacts.length).toBeGreaterThanOrEqual(25);
    expect(new Set(records.contacts.map((contact) => contact.name)).size).toBe(records.contacts.length);
    expect(new Set(records.contacts.map((contact) => contact.email)).size).toBe(records.contacts.length);
    expect(records.contacts.every((contact) => contact.email.endsWith(".example.com") && contact.phone.includes("555-01"))).toBe(true);
    expect(records.deals.every((deal) => records.contacts.some((contact) => contact.name === deal.contact && contact.company === deal.company))).toBe(true);
    expect(leadCounts).toEqual({ New: 7, Contacted: 5, Qualified: 5, Unqualified: 3 });
    expect(requiredSources.every((source) => records.leads.some((lead) => lead.source === source))).toBe(true);
    expect(records.deals.length).toBeGreaterThanOrEqual(20);
    expect(records.deals.filter((deal) => deal.status === "won")).toHaveLength(4);
    expect(records.deals.filter((deal) => deal.status === "lost")).toHaveLength(3);
    expect(["Discovery", "Qualified", "Proposal", "Negotiation"].every((stage) => openDeals.some((deal) => deal.stage === stage))).toBe(true);
    expect(requiredSources.every((source) => records.deals.some((deal) => deal.source === source))).toBe(true);
    expect(openDeals.some((deal) => deal.expectedCloseDate < fixtureDate.toISOString().slice(0, 10))).toBe(true);
    expect(openDeals.some((deal) => deal.lastActivityAt && new Date(deal.lastActivityAt).getTime() >= fixtureDate.getTime() - 7 * 86400000)).toBe(true);
    expect(records.deals.some((deal) => deal.company === "Summit Tech" && !records.tasks.some((task) => task.status === "open" && task.relatedTo === deal.company && new Date(task.dueAt) > fixtureDate))).toBe(true);

    const openTasks = records.tasks.filter((task) => task.status === "open");
    expect(records.tasks.length).toBeGreaterThanOrEqual(25);
    expect(openTasks.some((task) => isTaskOverdue(task, fixtureDate))).toBe(true);
    expect(openTasks.some((task) => calendarDayOffset(task.dueAt, fixtureDate) === 0)).toBe(true);
    expect(openTasks.some((task) => calendarDayOffset(task.dueAt, fixtureDate) === 1)).toBe(true);
    expect(openTasks.some((task) => calendarDayOffset(task.dueAt, fixtureDate) >= 7 && calendarDayOffset(task.dueAt, fixtureDate) <= 13)).toBe(true);
    expect(records.tasks.some((task) => task.status === "completed")).toBe(true);
  });

  it("adds date-relative meeting, note, stage, and task events to the four highest-value deals", () => {
    const records = createDemoRecords(fixtureDate);
    const laterFixtureDate = new Date("2025-05-20T12:00:00.000Z");
    const laterRecords = createDemoRecords(laterFixtureDate);
    const requiredKinds = ["meeting", "note", "stageChange", "taskCompletion"];
    const highValueDeals = [...records.deals].sort((left, right) => right.amount - left.amount).slice(0, 4);

    highValueDeals.forEach((deal) => {
      const expectedDetail = `${deal.title} · ${deal.company}`;
      const dealActivities = records.activities.filter((activity) => activity.detail === expectedDetail);
      const shiftedActivities = laterRecords.activities.filter((activity) => activity.detail === expectedDetail);

      expect(dealActivities).toHaveLength(requiredKinds.length);
      expect(dealActivities.map((activity) => activity.kind).sort()).toEqual([...requiredKinds].sort());
      expect(dealActivities.every((activity) => isInDateScope(activity.occurredAt, "30days", fixtureDate))).toBe(true);
      expect(shiftedActivities.map((activity) => calendarDayOffset(activity.occurredAt, laterFixtureDate))).toEqual(
        dealActivities.map((activity) => calendarDayOffset(activity.occurredAt, fixtureDate)),
      );
    });

    const scopedActivities = selectDashboard(records, "30days", fixtureDate).activities;
    expect(scopedActivities.map((activity) => activity.occurredAt)).toEqual(
      [...scopedActivities].map((activity) => activity.occurredAt).sort((left, right) => right.localeCompare(left)),
    );
  });

  it("derives company summaries and report measures from the canonical records", () => {
    const records = createDemoRecords(fixtureDate);
    const report = selectDemoReports(records);
    const wonDeals = records.deals.filter((deal) => deal.status === "won");
    const lostDeals = records.deals.filter((deal) => deal.status === "lost");
    records.companies.forEach((company) => {
      const companyDeals = records.deals.filter((deal) => deal.company === company.name);
      expect(company.contactCount).toBe(records.contacts.filter((contact) => contact.company === company.name).length);
      expect(company.openPipeline).toBe(companyDeals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.amount, 0));
    });
    expect(records.companies.reduce((sum, company) => sum + company.contactCount, 0)).toBe(records.contacts.length);
    expect(report).toMatchObject({
      totalDeals: records.deals.length,
      totalContacts: records.contacts.length,
      wonRevenue: wonDeals.reduce((sum, deal) => sum + deal.amount, 0),
      winRate: wonDeals.length / (wonDeals.length + lostDeals.length),
      averageDealValue: records.deals.reduce((sum, deal) => sum + deal.amount, 0) / records.deals.length,
      openPipeline: records.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.amount, 0),
      totalLeads: records.leads.length,
      completedTasks: records.tasks.filter((task) => task.status === "completed").length,
    });
    expect(report.topDeals.map((deal) => deal.amount)).toEqual([...records.deals].map((deal) => deal.amount).sort((a, b) => b - a).slice(0, 5));
    expect(report.stageTotals.reduce((sum, stage) => sum + stage.count, 0)).toBe(records.deals.length);
    expect(report.sourceTotals.reduce((sum, source) => sum + source.count, 0)).toBe(records.deals.length);
  });
});
