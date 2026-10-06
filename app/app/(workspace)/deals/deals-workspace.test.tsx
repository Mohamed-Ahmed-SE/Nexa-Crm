import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DealsData } from "@/lib/deals/repository";
import { DealsWorkspace } from "./deals-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createDealAction: vi.fn(), moveDealStageAction: vi.fn(), updateDealAction: vi.fn() }));
const dealsData: DealsData = {
  pipelineId: "pipeline-1",
  pipelines: [{ id: "pipeline-1", name: "New Business" }],
  stages: [
    { id: "stage-open", name: "Discovery", position: 1, probability: 25, stage_type: "open", color_token: null },
    { id: "stage-won", name: "Won", position: 2, probability: 100, stage_type: "won", color_token: null },
    { id: "stage-lost", name: "Lost", position: 3, probability: 0, stage_type: "lost", color_token: null },
  ],
  deals: [
    { id: "deal-won", pipeline_id: "pipeline-1", stage_id: "stage-won", title: "Won platform deal", company_id: null, primary_contact_id: null, amount: 12000, currency: "USD", probability: 100, expected_close_date: null, owner_id: null, priority: "high", description: null, status: "won", company: null, contact: null },
    { id: "deal-lost", pipeline_id: "pipeline-1", stage_id: "stage-lost", title: "Lost services deal", company_id: null, primary_contact_id: null, amount: 5000, currency: "USD", probability: 0, expected_close_date: null, owner_id: null, priority: "medium", description: null, status: "lost", company: null, contact: null },
  ],
  companies: [],
  contacts: [],
  owners: [],
};

const boardProps = {
  data: dealsData,
  canCreate: false,
  canEditOwn: false,
  canEditAll: false,
  canReassign: false,
  currentUserId: "user-1",
  search: "",
  ownerFilter: "",
  todayIso: "2026-04-03",
  view: "board" as const,
  createIntent: false,
};

describe("DealsWorkspace board", () => {
  it("shows won and lost deals in their terminal stages without an unavailable message", () => {
    render(<DealsWorkspace {...boardProps} />);

    const board = screen.getByRole("region", { name: "New Business stages" });
    expect(within(board).getByRole("article", { name: /Won platform deal/ })).toBeInTheDocument();
    expect(within(board).getByRole("article", { name: /Lost services deal/ })).toBeInTheDocument();
    expect(within(board).queryByText(/outcomes are not available yet/i)).not.toBeInTheDocument();
  });
});
