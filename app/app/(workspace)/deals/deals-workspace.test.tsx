import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DealsData } from "@/lib/deals/repository";
import type { DealNextTask } from "@/lib/deals/next-tasks";
import type { DealAttentionReason } from "@/lib/deals/attention";
import { DealsWorkspace } from "./deals-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createDealAction: vi.fn(), duplicateDealAction: vi.fn(), moveDealStageAction: vi.fn(), updateDealAction: vi.fn() }));

Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } });
const dealsData: DealsData = {
  pipelineId: "pipeline-1",
  pipelines: [{ id: "pipeline-1", name: "New Business" }],
  stages: [
    { id: "stage-open", pipeline_id: "pipeline-1", name: "Discovery", position: 1, probability: 25, stage_type: "open", color_token: null },
    { id: "stage-won", pipeline_id: "pipeline-1", name: "Won", position: 2, probability: 100, stage_type: "won", color_token: null },
    { id: "stage-lost", pipeline_id: "pipeline-1", name: "Lost", position: 3, probability: 0, stage_type: "lost", color_token: null },
  ],
  tags: [{ id: "tag-priority", name: "Strategic", color_token: null }, { id: "tag-other", name: "Expansion", color_token: "blue" }],
  deals: [
    { id: "deal-won", pipeline_id: "pipeline-1", stage_id: "stage-won", title: "Won platform deal", company_id: null, primary_contact_id: null, amount: 12000, currency: "USD", probability: 100, expected_close_date: null, owner_id: null, priority: "high", description: null, status: "won", created_at: "2026-03-01T12:00:00.000Z", company: null, contact: null, tags: [{ id: "tag-priority", name: "Strategic", color_token: null }] },
    { id: "deal-lost", pipeline_id: "pipeline-1", stage_id: "stage-lost", title: "Lost services deal", company_id: null, primary_contact_id: null, amount: 5000, currency: "USD", probability: 0, expected_close_date: null, owner_id: null, priority: "medium", description: null, status: "lost", created_at: "2026-03-01T12:00:00.000Z", company: null, contact: null },
  ],
  companies: [],
  contacts: [],
  owners: [],
};

const boardProps = {
  data: dealsData,
  nextTasks: { "deal-won": { title: "Send proposal", due_at: "2026-04-05" } } satisfies Record<string, DealNextTask>,
  attentionReasons: {},
  canCreate: false,
  canExport: false,
  canEditOwn: false,
  canEditAll: false,
  canReassign: false,
  currentUserId: "user-1",
  search: "",
  ownerFilter: "",
  statusFilter: "all" as const,
  wonFrom: "",
  wonTo: "",
  todayIso: "2026-04-03",
  view: "board" as const,
  createIntent: false,
};

describe("DealsWorkspace KPI drill-through", () => {
  const wonRange = { statusFilter: "won" as const, wonFrom: "2026-04-01T00:00:00.000Z", wonTo: "2026-05-01T00:00:00.000Z" };

  it("shows won KPI matches in list view even without active stages and clears the date range", () => {
    render(<DealsWorkspace {...boardProps} {...wonRange} data={{ ...dealsData, pipelineId: "all", stages: [], deals: [dealsData.deals[0]] }} view="list" />);

    expect(screen.getByRole("link", { name: "View details for Won platform deal" })).toHaveAttribute("href", "/app/deals/deal-won");
    expect(within(screen.getByRole("row", { name: /Won platform deal/ })).getByText("New Business · Won")).toBeInTheDocument();
    const filters = screen.getByRole("group", { name: "Active filters" });
    expect(filters).toHaveTextContent("Won date range (end exclusive): 2026-04-01T00:00:00.000Z – 2026-05-01T00:00:00.000Z");
    expect(within(filters).getByRole("link", { name: "Clear date range" })).toHaveAttribute("href", "/app/deals?pipeline=all&status=won&view=list");
  });

  it("shows clearable pipeline and status filters for the open-deals KPI", () => {
    render(<DealsWorkspace {...boardProps} statusFilter="open" data={{ ...dealsData, pipelineId: "all", deals: [] }} view="list" />);

    const filters = screen.getByRole("group", { name: "Active filters" });
    expect(filters).toHaveTextContent("Pipeline: All pipelines");
    expect(filters).toHaveTextContent("Status: Open");
    expect(within(filters).getByRole("link", { name: "Clear pipeline filter" })).toHaveAttribute("href", "/app/deals?status=open&view=list");
    expect(within(filters).getByRole("link", { name: "Clear status filter" })).toHaveAttribute("href", "/app/deals?pipeline=all&view=list");
    expect(screen.getByText("No matching deals")).toBeInTheDocument();
  });

  it("only offers stages from a deal's own pipeline when listing all pipelines", () => {
    const otherStage = { id: "stage-other", pipeline_id: "pipeline-2", name: "Partner intro", position: 1, probability: 10, stage_type: "open" as const, color_token: null };
    const openDeal = { ...dealsData.deals[0], id: "deal-open", title: "Open renewal", stage_id: "stage-open", status: "open" as const };
    render(<DealsWorkspace {...boardProps} canEditAll statusFilter="open" data={{ ...dealsData, pipelineId: "all", pipelines: [...dealsData.pipelines, { id: "pipeline-2", name: "Partners" }], stages: [...dealsData.stages, otherStage], deals: [openDeal] }} view="list" />);

    const move = screen.getByRole("combobox", { name: "Move Open renewal to stage" });
    expect(within(move).queryByRole("option", { name: "Partner intro" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Open renewal/ })).getByText("New Business · Discovery")).toBeInTheDocument();
  });

  it("keeps KPI filters in the view switch and export links", () => {
    render(<DealsWorkspace {...boardProps} {...wonRange} canExport data={{ ...dealsData, pipelineId: "all" }} view="list" />);

    expect(screen.getByRole("link", { name: "Board view" })).toHaveAttribute("href", "/app/deals?pipeline=all&status=won&wonFrom=2026-04-01T00%3A00%3A00.000Z&wonTo=2026-05-01T00%3A00%3A00.000Z&view=board");
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", "/app/deals/export?pipeline=all&status=won&wonFrom=2026-04-01T00%3A00%3A00.000Z&wonTo=2026-05-01T00%3A00%3A00.000Z");
  });
});

describe("DealsWorkspace owner editing", () => {
  it("offers the retained inactive owner as the selected option", async () => {
    const user = userEvent.setup();
    const inactiveDeal = {
      ...dealsData.deals[0], id: "deal-inactive-owner", title: "Inactive owner deal", stage_id: "stage-open",
      owner_id: "inactive-user", status: "open" as const,
    };
    render(<DealsWorkspace {...boardProps} data={{ ...dealsData, deals: [inactiveDeal], owners: [{ id: "active-user", label: "Active user" }] }} canEditAll canReassign />);

    await user.click(screen.getByRole("button", { name: "Inactive owner deal" }));
    const owner = within(screen.getByRole("dialog")).getByRole("combobox", { name: "Owner" });
    expect(owner).toHaveValue("inactive-user");
    expect(within(owner).getByRole("option", { name: "Current owner · Inactive user" })).toHaveValue("inactive-user");
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Strategic" })).toBeChecked();
  });
});

describe("DealsWorkspace deal attention", () => {
  it("shows each attention reason on board cards and list rows", () => {
    const deal = { ...dealsData.deals[0], id: "deal-open", title: "Open renewal", stage_id: "stage-open", status: "open" as const, expected_close_date: "2026-04-14" };
    const attentionProps = {
      ...boardProps,
      data: { ...dealsData, deals: [deal] },
      attentionReasons: { "deal-open": ["overdue-close", "stale-activity", "no-future-task"] satisfies DealAttentionReason[] },
    };
    const { rerender } = render(<DealsWorkspace {...attentionProps} />);

    expect(screen.getByRole("note", { name: "Attention needed: Expected close date has passed, No activity in the last 14 days, No future task scheduled" })).toHaveTextContent("Overdue close · Stale activity · No future task");
    rerender(<DealsWorkspace {...attentionProps} view="list" />);
    expect(screen.getByRole("note", { name: "Attention needed: Expected close date has passed, No activity in the last 14 days, No future task scheduled" })).toHaveTextContent("Overdue close · Stale activity · No future task");
  });
});

describe("DealsWorkspace board", () => {
  it("shows a task title and due date on its Kanban card but not in list view", () => {
    const { rerender } = render(<DealsWorkspace {...boardProps} />);

    expect(screen.getByRole("article", { name: /Won platform deal/ })).toHaveTextContent("Next task: Send proposal · 04/05/2026");
    rerender(<DealsWorkspace {...boardProps} view="list" />);
    expect(screen.queryByText(/Next task: Send proposal/)).not.toBeInTheDocument();
  });

  it("omits the next-task indicator when no open task exists", () => {
    render(<DealsWorkspace {...boardProps} nextTasks={{}} />);

    expect(screen.queryByText(/^Next task:/)).not.toBeInTheDocument();
  });

  it("shows won and lost deals in their terminal stages without an unavailable message", () => {
    render(<DealsWorkspace {...boardProps} />);

    const board = screen.getByRole("region", { name: "New Business stages" });
    expect(within(board).getByRole("article", { name: /Won platform deal/ })).toBeInTheDocument();
    expect(within(board).getByRole("article", { name: /Lost services deal/ })).toBeInTheDocument();
    expect(within(board).queryByText(/outcomes are not available yet/i)).not.toBeInTheDocument();
  });

  it("offers duplication for each deal in both views only when creation is permitted", () => {
    const { rerender } = render(<DealsWorkspace {...boardProps} canCreate />);
    expect(screen.getAllByRole("button", { name: "Duplicate" })).toHaveLength(2);

    rerender(<DealsWorkspace {...boardProps} canCreate view="list" />);
    expect(screen.getAllByRole("button", { name: "Duplicate" })).toHaveLength(2);

    rerender(<DealsWorkspace {...boardProps} view="list" />);
    expect(screen.queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();
  });

  it("shows assigned tags on board cards and list rows", () => {
    const { rerender } = render(<DealsWorkspace {...boardProps} />);
    expect(screen.getByRole("article", { name: /Won platform deal/ })).toHaveTextContent("Strategic");
    rerender(<DealsWorkspace {...boardProps} view="list" />);
    expect(screen.getByRole("row", { name: /Won platform deal/ })).toHaveTextContent("Strategic");
  });

  it("offers an accessible tag selector when creating a deal", async () => {
    const user = userEvent.setup();
    render(<DealsWorkspace {...boardProps} canCreate />);
    await user.click(screen.getByRole("button", { name: "Add Deal" }));
    const dialog = screen.getByRole("dialog", { name: "Add deal" });
    expect(within(dialog).getByRole("group", { name: "Tags" })).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Strategic" })).not.toBeChecked();
    await user.click(within(dialog).getByRole("checkbox", { name: "Strategic" }));
    expect(within(dialog).getByRole("checkbox", { name: "Strategic" })).toBeChecked();
  });

  it("offers export only when permitted and retains the active filters", () => {
    const { rerender } = render(<DealsWorkspace {...boardProps} canExport />);
    const exportLink = screen.getByRole("link", { name: "Export CSV" });
    expect(exportLink).toHaveAttribute("href", "/app/deals/export?pipeline=pipeline-1");

    rerender(<DealsWorkspace {...boardProps} canExport search="Acme + North" ownerFilter="unassigned" view="list" />);
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", "/app/deals/export?pipeline=pipeline-1&q=Acme+%2B+North&owner=unassigned");

    rerender(<DealsWorkspace {...boardProps} />);
    expect(screen.queryByRole("link", { name: "Export CSV" })).not.toBeInTheDocument();
  });
});
