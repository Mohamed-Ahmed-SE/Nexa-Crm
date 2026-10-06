import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadWorkspace } from "./lead-workspace";
import { convertLeadAction } from "./actions";
import type { LeadRow } from "@/lib/leads/repository";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("./actions", () => ({ createLeadAction: vi.fn(), updateLeadAction: vi.fn(), convertLeadAction: vi.fn(), saveLeadViewAction: vi.fn(), deleteLeadViewAction: vi.fn() }));

Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } });

const lead: LeadRow = {
  id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", full_name: "Taylor Reed", company_name: "Acme", email: "taylor@example.test",
  phone: null, job_title: null, source_id: null, status: "qualified", owner_id: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", estimated_value: 1250,
  currency: "USD", notes_summary: null, created_at: "2026-04-01T12:00:00Z", updated_at: "2026-04-02T12:00:00Z",
};
const view = {
  id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", name: "Qualified high value",
  filters: { q: "", status: "qualified" as const, sourceId: "", ownerId: "" }, sort: "value_desc" as const,
  visibleColumns: ["name", "value"] as ("name" | "value")[],
};
const props = {
  leads: [lead], sources: [], owners: [{ id: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", label: "Taylor Reed" }], canCreate: false, canImport: false, canExport: false, createIntent: false,
  canEditAll: false, canConvert: false, conversionOptions: { pipelineId: "", pipelines: [] }, canReassign: false, currentUserId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", currency: "USD",
  search: "", statusFilter: "qualified", sourceFilter: "", ownerFilter: "", page: 1, totalCount: 1, matchedCount: 1,
  newCount: 0, qualifiedCount: 1, sort: "value_desc" as const, visibleColumns: ["name", "value"] as ("name" | "value")[],
  savedViews: [view], activeViewId: view.id,
};

describe("LeadWorkspace saved views", () => {
  it("offers the user's saved view and renders only its selected data columns", () => {
    render(<LeadWorkspace {...props} />);

    expect(screen.getByRole("combobox", { name: "Saved view" })).toHaveValue(view.id);
    expect(screen.getByRole("option", { name: "Qualified high value" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort leads" })).toHaveValue("value_desc");
    const row = screen.getByRole("row", { name: /Taylor Reed/ });
    expect(within(row).getByRole("link", { name: "Taylor Reed" })).toHaveAttribute("href", `/app/leads/${lead.id}`);
    expect(within(row).getByText("$1,250")).toBeInTheDocument();
    expect(within(row).queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Visible columns" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete this view" })).toBeInTheDocument();
  });

  it("opens conversion confirmation for an editable unconverted lead only", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LeadWorkspace {...props} canConvert conversionOptions={{ pipelineId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", pipelines: [{ id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", name: "Default", stages: [{ id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", name: "Discovery" }] }] }} />);

    await user.click(screen.getByRole("button", { name: "Convert Taylor Reed" }));
    const dialog = screen.getByRole("dialog", { name: "Convert Taylor Reed" });
    expect(within(dialog).getByRole("checkbox", { name: "Contact" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Company" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Deal" })).toBeChecked();
    expect(within(dialog).getByRole("combobox", { name: "Deal owner" })).toHaveValue("6d648c6b-8d8f-4a16-90c4-72f3c31c61a2");
    unmount();

    render(<LeadWorkspace {...props} canConvert leads={[{ ...lead, status: "converted" }]} />);
    expect(screen.queryByRole("button", { name: "Convert Taylor Reed" })).not.toBeInTheDocument();
  });

  it("keeps conversion options open and reports a failed confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(convertLeadAction).mockResolvedValue({ message: "Lead conversion failed." });
    render(<LeadWorkspace {...props} canConvert conversionOptions={{ pipelineId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", pipelines: [{ id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", name: "Default", stages: [{ id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", name: "Discovery" }] }] }} />);

    await user.click(screen.getByRole("button", { name: "Convert Taylor Reed" }));
    await user.click(screen.getByRole("button", { name: "Convert lead" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lead conversion failed.");
    expect(screen.getByRole("dialog", { name: "Convert Taylor Reed" })).toBeInTheDocument();
  });

  it("submits successfully when Deal is unchecked", async () => {
    const user = userEvent.setup();
    routerMocks.refresh.mockClear();
    vi.mocked(convertLeadAction).mockClear();
    vi.mocked(convertLeadAction).mockResolvedValue({ ok: true, contactId: "a1100000-0000-4000-8000-000000000001", companyId: null, dealId: null });
    render(<LeadWorkspace {...props} canConvert conversionOptions={{ pipelineId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", pipelines: [{ id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", name: "Default", stages: [{ id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", name: "Discovery" }] }] }} />);

    await user.click(screen.getByRole("button", { name: "Convert Taylor Reed" }));
    await user.click(screen.getByRole("checkbox", { name: "Deal" }));
    expect(screen.getByRole("checkbox", { name: "Deal" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Convert lead" }));

    const submittedForm = vi.mocked(convertLeadAction).mock.calls[0]?.[0];
    expect(submittedForm?.get("createDeal")).toBeNull();
    expect(submittedForm?.get("dealValue")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Convert Taylor Reed" })).not.toBeInTheDocument());
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  it("closes and refreshes after conversion completes without verifiable record links", async () => {
    const user = userEvent.setup();
    routerMocks.refresh.mockClear();
    vi.mocked(convertLeadAction).mockResolvedValue({ ok: true, conversionCompleted: true, message: "Conversion completed, but its record links could not be verified." });
    render(<LeadWorkspace {...props} canConvert conversionOptions={{ pipelineId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", pipelines: [{ id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6", name: "Default", stages: [{ id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", name: "Discovery" }] }] }} />);

    await user.click(screen.getByRole("button", { name: "Convert Taylor Reed" }));
    await user.click(screen.getByRole("button", { name: "Convert lead" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Convert Taylor Reed" })).not.toBeInTheDocument());
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a selected view when filters or sort change, but keeps an explicitly reselected view", async () => {
    const user = userEvent.setup();
    render(<LeadWorkspace {...props} />);
    const savedViewSelect = screen.getByRole("combobox", { name: "Saved view" });
    const filterForm = screen.getByRole("button", { name: "Apply filters" }).closest("form");

    await user.type(screen.getByRole("searchbox", { name: "Search leads by name, company, or email" }), "Acme");
    expect(savedViewSelect).toHaveValue("");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "new");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort leads" }), "name_asc");

    const editedFilters = new FormData(filterForm!);
    expect(editedFilters.get("q")).toBe("Acme");
    expect(editedFilters.get("status")).toBe("new");
    expect(editedFilters.get("sort")).toBe("name_asc");
    expect(editedFilters.get("view")).toBe("");

    await user.selectOptions(savedViewSelect, view.id);
    expect(new FormData(filterForm!).get("view")).toBe(view.id);
  });
});
