import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { createDemoRecords, getAttentionReasons, isTaskOverdue, selectDashboard, type DashboardRecords } from "@/lib/dashboard-data";

const now = new Date("2025-04-15T12:00:00.000Z");

describe("dashboard selectors", () => {
  it("derives metrics from the underlying deal, lead, and task records", () => {
    const records = createDemoRecords(now);
    const summary = selectDashboard(records, "all", now);

    expect(summary.pipelineValue).toBe(records.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.amount, 0));
    expect(summary.openDealCount).toBe(8);
    expect(summary.wonRevenue).toBe(161500);
    expect(summary.overdueTaskCount).toBe(2);
    expect(summary.newLeadCount).toBe(records.leads.length);
  });

  it("returns zero-aware totals for an empty workspace", () => {
    const emptyRecords: DashboardRecords = { deals: [], leads: [], tasks: [], activities: [] };
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

    expect(month.newLeadCount).toBe(5);
    expect(month.wonRevenue).toBe(161500);
    expect(overdue.map((task) => task.id)).toEqual(["t1", "t5"]);
    expect(getAttentionReasons(records.deals.find((deal) => deal.id === "d2")!, records.tasks, now)).toContain("No activity in 14+ days");
    expect(getAttentionReasons(records.deals.find((deal) => deal.id === "d9")!, records.tasks, now)).toEqual([]);
  });
});

describe("SalesDashboard", () => {
  it("changes date scope, view, search results, and needs-attention filtering", () => {
    render(<SalesDashboard />);
    expect(screen.getByText("Sample demo workspace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open deals/i })).toHaveAttribute("href", "/app/deals");
    expect(screen.getByRole("button", { name: "Add deal" })).toBeDisabled();
    expect(screen.getByText("Fictional records for preview only — not live customer data. Nothing here is saved.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Dashboard date range" }), { target: { value: "all" } });
    expect(screen.getByRole("link", { name: /new leads/i })).toHaveTextContent("8");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort deals" }), { target: { value: "amount" } });
    expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent("Atlas Property Group");
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
    fireEvent.change(screen.getByRole("combobox", { name: "Dashboard date range" }), { target: { value: "all" } });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "text/csv;charset=utf-8" }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(/exported 12 deals as csv/i)).toBeInTheDocument();
  });
});
