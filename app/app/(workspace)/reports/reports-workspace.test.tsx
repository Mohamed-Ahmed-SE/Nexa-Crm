import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReportData } from "@/lib/reports/repository";
import { ReportsWorkspace } from "./reports-workspace";

const report: ReportData = {
  currency: "USD",
  summary: { won_revenue: 12000, total_deal_value: 30000, total_deals: 3, won_count: 2, lost_count: 1, average_deal_value: 10000 },
  revenue_trend: [{ month: "2025-04-01T00:00:00.000Z", amount: 12000, deals: 2 }],
  pipeline_by_stage: [{ name: "Discovery", position: 1, deals: 1, amount: 5000 }],
  deals_by_source: [{ name: "Referral", deals: 2, amount: 24000 }],
  activity_by_rep: [{ owner_id: "91000000-0000-4000-8000-000000000001", name: "Alex Rivera", activities: 4 }],
  top_deals: [{ id: "93000000-0000-4000-8000-000000000001", title: "Deal A", company: "Company A", owner: "Alex Rivera", stage: "Discovery", amount: 15000, created_at: "2025-04-14T12:00:00.000Z", status: "open" }],
  outcomes: { won: 2, lost: 1, open: 1 },
};
const props = {
  report,
  owners: [{ id: "91000000-0000-4000-8000-000000000001", name: "Alex Rivera" }],
  pipelines: [{ id: "94000000-0000-4000-8000-000000000001", name: "Main" }],
  filters: { start: "2025-04-01", end: "2025-04-30", ownerId: "all", pipelineId: "all", invalid: false },
  currency: "USD",
};

describe("ReportsWorkspace", () => {
  it("shows filter controls, metric meanings, all analysis sections, and the bounded high-value table", () => {
    render(<ReportsWorkspace {...props} />);
    expect(screen.getByLabelText("Start date")).toHaveValue("2025-04-01");
    expect(screen.getByRole("option", { name: "Alex Rivera" })).toBeInTheDocument();
    const activityPanel = screen.getByRole("heading", { name: "Activity by Rep" }).closest("article");
    expect(within(activityPanel!).getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export filtered report as CSV" })).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/Current open pipeline is a snapshot/)).toBeInTheDocument();
    for (const heading of ["Revenue Trend", "Pipeline by Stage", "Deals by Source", "Win/Loss Summary", "Activity by Rep", "Highest-value deals created"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Deal A" })).toHaveAttribute("href", "/app/deals/93000000-0000-4000-8000-000000000001");
    expect(within(table).getByText("Alex Rivera")).toBeInTheDocument();
    expect(within(table).getByText("$15,000")).toBeInTheDocument();
  });

  it("explains empty results without presenting a fabricated win rate or chart", () => {
    render(<ReportsWorkspace {...props} report={{ ...report, summary: { won_revenue: 0, total_deal_value: 0, total_deals: 0, won_count: 0, lost_count: 0, average_deal_value: 0 }, revenue_trend: [], pipeline_by_stage: [], deals_by_source: [], activity_by_rep: [], top_deals: [], outcomes: { won: 0, lost: 0, open: 0 } }} />);
    expect(screen.getByText("Win rate").parentElement).toHaveTextContent("—");
    expect(screen.getByText("No won revenue in this period.")).toBeInTheDocument();
    expect(screen.getByText("No deals match the selected creation date, owner, pipeline, and currency.")).toBeInTheDocument();
  });
});
