import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { createDemoRecords, getAttentionReasons, isInDateScope, isTaskOverdue, selectDashboard, type DashboardRecords } from "@/lib/dashboard-data";

const now = new Date("2025-04-15T12:00:00.000Z");

describe("dashboard selectors", () => {
  it("derives metrics from the underlying deal, lead, and task records", () => {
    const records = createDemoRecords(now);
    const summary = selectDashboard(records, "all", now);

    expect(summary.pipelineValue).toBe(records.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.amount, 0));
    expect(summary.openDealCount).toBe(records.deals.filter((deal) => deal.status === "open").length);
    expect(summary.wonRevenue).toBe(records.deals.filter((deal) => deal.status === "won").reduce((sum, deal) => sum + deal.amount, 0));
    expect(summary.overdueTaskCount).toBe(records.tasks.filter((task) => isTaskOverdue(task, now)).length);
    expect(summary.newLeadCount).toBe(records.leads.length);
  });

  it("returns zero-aware totals for an empty workspace", () => {
    const emptyRecords: DashboardRecords = { deals: [], leads: [], contacts: [], companies: [], tasks: [], activities: [] };
    const summary = selectDashboard(emptyRecords, "month", now);

    expect(summary).toMatchObject({ pipelineValue: 0, openDealCount: 0, newLeadCount: 0, wonRevenue: 0, overdueTaskCount: 0, dueToday: [], scopedDeals: [] });
    expect(summary.stageTotals.every((stage) => stage.count === 0 && stage.amount === 0)).toBe(true);
    expect(summary.sourceTotals).toEqual([]);
    expect(summary.activities).toEqual([]);
    expect(summary.attentionDeals).toEqual([]);
  });

  it("applies current-period scope and open-task overdue definitions", () => {
    const records = createDemoRecords(now);
    const month = selectDashboard(records, "month", now);
    const overdue = records.tasks.filter((task) => isTaskOverdue(task, now));

    expect(month.newLeadCount).toBe(records.leads.filter((lead) => isInDateScope(lead.createdAt, "month", now)).length);
    expect(month.wonRevenue).toBe(records.deals.filter((deal) => deal.wonAt && isInDateScope(deal.wonAt, "month", now)).reduce((sum, deal) => sum + deal.amount, 0));
    expect(month.overdueTaskCount).toBe(overdue.length);
    expect(overdue.every((task) => isTaskOverdue(task, now))).toBe(true);
    expect(getAttentionReasons(records.deals.find((deal) => deal.id === "d2")!, records.tasks, now)).toContain("No activity in 14+ days");
    expect(getAttentionReasons(records.deals.find((deal) => deal.id === "d9")!, records.tasks, now)).toEqual([]);
  });
});

describe("SalesDashboard", () => {
  it("changes date scope, view, search results, and needs-attention filtering", () => {
    const records = createDemoRecords();
    render(<SalesDashboard />);
    expect(screen.getByText("Sample demo workspace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open deals/i })).toHaveAttribute("href", "/demo/deals");
    expect(screen.getByRole("link", { name: /new leads/i })).toHaveAttribute("href", "/demo/leads");
    expect(screen.getByRole("link", { name: /overdue tasks/i })).toHaveAttribute("href", "/demo/tasks");
    expect(screen.getByRole("button", { name: "Add deal" })).toBeDisabled();
    expect(screen.getByText("Fictional records for preview only — not live customer data. Nothing here is saved.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Dashboard date range" }), { target: { value: "all" } });
    expect(screen.getByRole("link", { name: /new leads/i })).toHaveTextContent(String(records.leads.length));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort deals" }), { target: { value: "amount" } });
    const highestValueCompany = [...records.deals].sort((left, right) => right.amount - left.amount)[0].company;
    expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent(highestValueCompany);
    fireEvent.click(screen.getByRole("button", { name: /kanban/i }));
    expect(screen.getByRole("button", { name: /kanban/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter deals" }), { target: { value: "attention" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search deals" }), { target: { value: "Vertex Logistics" } });
    expect(screen.getByRole("region", { name: "Deals by pipeline stage" })).toHaveTextContent("Fleet visibility rollout");
    expect(screen.getByRole("region", { name: "Deals by pipeline stage" })).not.toHaveTextContent("Luna Commerce");
    fireEvent.change(screen.getByRole("textbox", { name: "Search deals" }), { target: { value: "no matching record" } });
    expect(screen.getByText(/no deals match this view/i)).toBeInTheDocument();
  });

  it("downloads the currently visible deals as a CSV", () => {
    const createObjectURL = vi.fn(() => "blob:dashboard-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<SalesDashboard />);
    const expectedDealCount = createDemoRecords().deals.length;
    fireEvent.change(screen.getByRole("combobox", { name: "Dashboard date range" }), { target: { value: "all" } });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "text/csv;charset=utf-8" }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(new RegExp(`exported ${expectedDealCount} deals as csv`, "i"))).toBeInTheDocument();
  });
});
