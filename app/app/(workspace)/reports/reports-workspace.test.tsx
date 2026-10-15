import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportData } from "@/lib/reports/repository";
import { ReportsWorkspace } from "./reports-workspace";

const report: ReportData = {
  currency: "USD",
  summary: { won_revenue: 12000, total_deal_value: 30000, total_deals: 3, won_count: 2, lost_count: 1, average_deal_value: 10000 },
  revenue_trend: [{ month: "2025-04-01T00:00:00.000Z", amount: 12000, deals: 2 }],
  pipeline_by_stage: [{ pipeline_id: "94000000-0000-4000-8000-000000000001", pipeline: "Main", stage_id: "95000000-0000-4000-8000-000000000001", name: "Discovery", position: 1, deals: 1, amount: 5000 }],
  pipeline_by_owner: [{ owner_id: "91000000-0000-4000-8000-000000000001", owner: "Alex Rivera", deals: 1, amount: 5000 }],
  deals_by_source: [{ source_id: "96000000-0000-4000-8000-000000000001", name: "Referral", deals: 2, amount: 24000 }],
  lead_source_performance: [{ source_id: "96000000-0000-4000-8000-000000000001", name: "Referral", leads: 2, estimated_value: 18000 }],
  tasks: { completed: 3, overdue: 1 },
  deal_conversion_funnel: [{ pipeline_id: "94000000-0000-4000-8000-000000000001", pipeline: "Main", stage_id: "95000000-0000-4000-8000-000000000001", name: "Discovery", position: 1, deals: 1 }],
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReportsWorkspace", () => {
  it("shows filter controls, metric meanings, all analysis sections, and the bounded high-value table", () => {
    render(<ReportsWorkspace {...props} />);
    expect(screen.getByLabelText("Start date")).toHaveValue("2025-04-01");
    expect(screen.getByLabelText("End date")).toHaveValue("2025-04-30");
    expect(screen.getByLabelText("Owner")).toHaveValue("all");
    expect(screen.getByLabelText("Pipeline")).toHaveValue("all");
    expect(screen.getByRole("option", { name: "Alex Rivera" })).toBeInTheDocument();
    const activityPanel = screen.getByRole("heading", { name: "Activity by Rep" }).closest("article");
    expect(within(activityPanel!).getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export filtered report as CSV" })).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/Current open pipeline and overdue tasks are snapshots/)).toBeInTheDocument();
    expect(screen.getByText(/Stage entries include tracked structured events only/)).toBeInTheDocument();
    const funnelPanel = screen.getByRole("heading", { name: "Deal Conversion Funnel" }).closest("article");
    expect(within(funnelPanel!).getByText("1 deal entered")).toBeInTheDocument();
    expect(within(funnelPanel!).getByText(/stage-entry events inside the selected period/)).toBeInTheDocument();
    expect(screen.getByText("2 leads · $18,000")).toBeInTheDocument();
    expect(screen.getByText("3 completed")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    for (const heading of ["Revenue Trend", "Pipeline by Stage", "Pipeline Value by Owner", "Deals by Source", "Lead Source Performance", "Tasks Completed vs Overdue", "Deal Conversion Funnel", "Win/Loss Summary", "Activity by Rep", "Highest-value deals created"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Deal A" })).toHaveAttribute("href", "/app/deals/93000000-0000-4000-8000-000000000001");
    expect(within(table).getByText("Alex Rivera")).toBeInTheDocument();
    expect(within(table).getByText("$15,000")).toBeInTheDocument();
  });

  it("disambiguates duplicate owners and same-named stages across pipelines", () => {
    const duplicateNameReport: ReportData = {
      ...report,
      pipeline_by_stage: [
        { ...report.pipeline_by_stage[0], pipeline: "Main" },
        { ...report.pipeline_by_stage[0], pipeline_id: "94000000-0000-4000-8000-000000000002", pipeline: "Growth", stage_id: "95000000-0000-4000-8000-000000000002" },
      ],
      pipeline_by_owner: [
        { owner_id: "91000000-0000-4000-8000-000000000003", owner: "Alex Teammate · #00000003", deals: 1, amount: 300 },
        { owner_id: "91000000-0000-4000-8000-000000000004", owner: "Alex Teammate · #00000004", deals: 1, amount: 400 },
      ],
      activity_by_rep: [
        { owner_id: "91000000-0000-4000-8000-000000000003", name: "Alex Teammate · #00000003", activities: 2 },
        { owner_id: "91000000-0000-4000-8000-000000000004", name: "Alex Teammate · #00000004", activities: 1 },
      ],
      deal_conversion_funnel: [
        { ...report.deal_conversion_funnel[0], pipeline: "Main" },
        { ...report.deal_conversion_funnel[0], pipeline_id: "94000000-0000-4000-8000-000000000002", pipeline: "Growth", stage_id: "95000000-0000-4000-8000-000000000002" },
      ],
    };
    render(<ReportsWorkspace {...props} report={duplicateNameReport} />);
    const stagePanel = screen.getByRole("heading", { name: "Pipeline by Stage" }).closest("article");
    const ownerPanel = screen.getByRole("heading", { name: "Pipeline Value by Owner" }).closest("article");
    const activityPanel = screen.getByRole("heading", { name: "Activity by Rep" }).closest("article");
    const funnelPanel = screen.getByRole("heading", { name: "Deal Conversion Funnel" }).closest("article");
    expect(within(stagePanel!).getByText("Main · Discovery")).toBeInTheDocument();
    expect(within(stagePanel!).getByText("Growth · Discovery")).toBeInTheDocument();
    expect(within(ownerPanel!).getByText("Alex Teammate · #00000003")).toBeInTheDocument();
    expect(within(ownerPanel!).getByText("Alex Teammate · #00000004")).toBeInTheDocument();
    expect(within(activityPanel!).getByText("Alex Teammate · #00000003")).toBeInTheDocument();
    expect(within(activityPanel!).getByText("Alex Teammate · #00000004")).toBeInTheDocument();
    expect(within(funnelPanel!).getByText("Main · Discovery")).toBeInTheDocument();
    expect(within(funnelPanel!).getByText("Growth · Discovery")).toBeInTheDocument();
  });

  it("exports the added metrics with their scope semantics", async () => {
    const user = userEvent.setup();
    let exportedCsv = "";
    class CapturingBlob extends Blob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        exportedCsv = parts.map((part) => typeof part === "string" ? part : "").join("");
      }
    }
    const reportUrl = Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:report",
      revokeObjectURL: () => undefined,
    });
    vi.stubGlobal("Blob", CapturingBlob);
    vi.stubGlobal("URL", reportUrl);
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<ReportsWorkspace {...props} />);
    await user.click(screen.getByRole("button", { name: "Export filtered report as CSV" }));
    expect(exportedCsv).toContain("Current open pipeline by owner");
    expect(exportedCsv).toContain("Lead source performance");
    expect(exportedCsv).toContain("Tasks completed");
    expect(exportedCsv).toContain("Tasks overdue");
    expect(exportedCsv).toContain("Tracked deal stage entries");
    expect(exportedCsv).toContain("unrecorded history is unavailable");
    expect(downloadClick).toHaveBeenCalledOnce();
  });

  it("keeps selected owner and pipeline controls visible on the filtered report", () => {
    const selectedFilters = { ...props.filters, ownerId: props.owners[0].id, pipelineId: props.pipelines[0].id };
    render(<ReportsWorkspace {...props} filters={selectedFilters} />);
    expect(screen.getByLabelText("Owner")).toHaveValue(props.owners[0].id);
    expect(screen.getByLabelText("Pipeline")).toHaveValue(props.pipelines[0].id);
    expect(screen.getByText(/pipeline filter does not apply/)).toBeInTheDocument();
    expect(screen.getByText(/Owner filters use assignee/)).toBeInTheDocument();
  });

  it("explains empty results without presenting a fabricated win rate or chart", () => {
    render(<ReportsWorkspace {...props} report={{ ...report, summary: { won_revenue: 0, total_deal_value: 0, total_deals: 0, won_count: 0, lost_count: 0, average_deal_value: 0 }, revenue_trend: [], pipeline_by_stage: [], pipeline_by_owner: [], deals_by_source: [], lead_source_performance: [], tasks: { completed: 0, overdue: 0 }, deal_conversion_funnel: [], activity_by_rep: [], top_deals: [], outcomes: { won: 0, lost: 0, open: 0 } }} />);
    expect(screen.getByText("Win rate").parentElement).toHaveTextContent("—");
    expect(screen.getByText("No won revenue in this period.")).toBeInTheDocument();
    expect(screen.getByText("No completed or overdue tasks match these filters.")).toBeInTheDocument();
    expect(screen.getByText("No leads were created in this period for the selected owner and currency.")).toBeInTheDocument();
    expect(screen.getByText("No tracked stage entries match these filters. Events without structured stage metadata and earlier unrecorded history are unavailable.")).toBeInTheDocument();
    expect(screen.getByText("No deals match the selected creation date, owner, pipeline, and currency.")).toBeInTheDocument();
  });
});
