import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardWorkspace } from "./dashboard-workspace";
import type { WorkspaceDashboardData } from "@/lib/dashboard/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const dashboardFixture: WorkspaceDashboardData = {
  currency: "USD",
  timeZone: "UTC",
  today: "2026-04-15",
  deals: [{ id: "deal-1", title: "Renewal project", company: "Northstar Labs", contact: "Alex Chen", stage: "Discovery", stageId: "stage-1", pipelineId: "pipeline-main", stageType: "open", amount: 24000, currency: "USD", owner: "Sam Rivera", expectedCloseDate: "2026-04-20", createdAt: "2026-04-01T12:00:00Z", lastActivityAt: "2026-04-14T12:00:00Z", wonAt: null, source: "Referral", status: "open" }, { id: "deal-eur", title: "Euro extension", company: "Northstar Labs", contact: null, stage: "Discovery", stageId: "stage-1", pipelineId: "pipeline-main", stageType: "open", amount: 1800, currency: "EUR", owner: "Sam Rivera", expectedCloseDate: "2026-05-20", createdAt: "2026-04-02T12:00:00Z", lastActivityAt: null, wonAt: null, source: "Referral", status: "open" }],
  stages: [{ id: "stage-1", name: "Discovery", pipelineId: "pipeline-main", pipelineName: "Sales", position: 1, stageType: "open" }],
  leads: [{ id: "lead-1", createdAt: "2026-04-10T12:00:00Z", source: "Web" }],
  tasks: [{ id: "task-1", title: "Send proposal", dueAt: "2026-04-15T16:00:00Z", priority: "high", relatedTo: "Renewal project", relatedId: "deal-1", relatedHref: "/app/deals/deal-1" }],
  activities: [{ id: "activity-1", subject: "Call logged", kind: "call", occurredAt: "2026-04-15T10:00:00Z", relatedTo: "Renewal project", relatedHref: "/app/deals/deal-1" }],
};

describe("DashboardWorkspace", () => {
  it("shows a recoverable error state without falling back to sample records", () => {
    render(<DashboardWorkspace state="unavailable" canCreate={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Dashboard data could not be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Renewal project")).not.toBeInTheDocument();
  });

  it("renders workspace metrics and data, and all empty panels explain their real empty state", () => {
    const { rerender } = render(<DashboardWorkspace state="ready" canCreate dashboard={dashboardFixture} />);
    expect(screen.getByRole("heading", { name: "Sales Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Won revenue/ })).toHaveAttribute("href", "/app/deals");
    expect(screen.getAllByText("$24,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText(new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(1800)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Renewal project" }).every((link) => link.getAttribute("href") === "/app/deals/deal-1")).toBe(true);
    expect(screen.getByText(/Call logged/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add deal" })).toHaveAttribute("href", "/app/deals?create=1");

    rerender(<DashboardWorkspace state="ready" canCreate={false} dashboard={{ ...dashboardFixture, deals: [], stages: [], leads: [], tasks: [], activities: [] }} />);
    expect(screen.getByText("No deals in this workspace yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add deal" })).not.toBeInTheDocument();
    expect(screen.getByText("No open tasks are due today.")).toBeInTheDocument();
    expect(screen.getByText("Activity will appear here when your team records it.")).toBeInTheDocument();
  });

  it("filters deals and switches to the live pipeline presentation", () => {
    render(<DashboardWorkspace state="ready" canCreate dashboard={dashboardFixture} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search deals" }), { target: { value: "missing" } });
    expect(screen.getByText("No deals match these filters")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search deals" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Pipeline" }));
    const pipeline = screen.getByRole("heading", { name: /Discovery/ }).closest("section");
    expect(within(pipeline!).getByRole("link", { name: /Renewal project/ })).toHaveAttribute("href", "/app/deals/deal-1");
  });

  it("neutralizes formula-leading user data in exported CSV cells", async () => {
    const exportedBlobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlobs.push(blob);
      return "blob:dashboard-export";
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const unsafeDeal = {
      ...dashboardFixture.deals[0],
      title: " =HYPERLINK(\"https://example.test\")",
      company: "+SUM(1,1)",
      contact: "-1+1",
      owner: "@SUM(1,1)",
    };
    render(<DashboardWorkspace state="ready" canCreate dashboard={{ ...dashboardFixture, deals: [unsafeDeal] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    const exportedBlob = exportedBlobs[0];
    if (!exportedBlob) throw new Error("CSV export did not create a Blob");
    const csv = await readBlobAsText(exportedBlob);
    expect(csv).toContain("\"' =HYPERLINK(\"\"https://example.test\"\")\"");
    expect(csv).toContain("\"'+SUM(1,1)\"");
    expect(csv).toContain("\"'-1+1\"");
    expect(csv).toContain("\"'@SUM(1,1)\"");
  });
});

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
