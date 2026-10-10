import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLeadAction } from "./actions";
import { LeadWorkspace } from "./lead-workspace";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("./actions", () => ({
  createLeadAction: vi.fn(),
  updateLeadAction: vi.fn(),
  convertLeadAction: vi.fn(),
  bulkAssignLeadsAction: vi.fn(),
  bulkTagLeadsAction: vi.fn(),
  saveLeadViewAction: vi.fn(),
  deleteLeadViewAction: vi.fn(),
}));

const props = {
  leads: [], sources: [], owners: [], tags: [], canCreate: true, canImport: false, canExport: false, createIntent: false,
  canEditAll: false, canConvert: false, conversionOptions: { pipelineId: "", pipelines: [] }, canReassign: false, canTag: false,
  currentUserId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", currency: "USD", search: "", statusFilter: "all",
  sourceFilter: "", tagFilter: "", ownerFilter: "", page: 1, totalCount: 0, matchedCount: 0, newCount: 0, qualifiedCount: 0,
  sort: "updated_desc" as const, visibleColumns: ["name"] as ("name")[], savedViews: [], activeViewId: "",
};

const duplicate = {
  id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084",
  full_name: "Jordan Lee",
  email: "jordan@example.test",
  phone: "+1 (415) 555-0100",
};

describe("lead duplicate warning form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows candidate details and requires a second Add lead anyway submission", async () => {
    const user = userEvent.setup();
    vi.mocked(createLeadAction)
      .mockResolvedValueOnce({ duplicateMatches: [duplicate] })
      .mockResolvedValueOnce({ ok: true, message: "Lead added." });
    render(<LeadWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Add Lead" }));
    const dialog = screen.getByRole("dialog", { name: "Add lead" });
    await user.type(within(dialog).getByRole("textbox", { name: "Full name" }), "Jordan Lee Jr.");
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "jordan@example.test");
    await user.click(within(dialog).getByRole("button", { name: "Add lead" }));

    const warning = await within(dialog).findByRole("status");
    expect(warning).toHaveAttribute("aria-live", "polite");
    expect(warning).toHaveClass("csv-import-warning");
    expect(warning).toHaveTextContent("Jordan Lee");
    expect(warning).toHaveTextContent("jordan@example.test");
    expect(warning).toHaveTextContent("+1 (415) 555-0100");
    expect(within(dialog).getByRole("button", { name: "Add lead anyway" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Add lead anyway" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add lead" })).not.toBeInTheDocument());
    const confirmedForm = vi.mocked(createLeadAction).mock.calls[1]?.[1];
    expect(confirmedForm?.get("confirmDuplicate")).toBe("true");
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });
});
