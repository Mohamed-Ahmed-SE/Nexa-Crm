import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompaniesWorkspace, CompanyDetailWorkspace } from "./companies-workspace";
import { deleteCompanyActivityAction, deleteCompanyNoteAction, toggleCompanyNotePinnedAction, updateCompanyAction, updateCompanyActivityAction, updateCompanyNoteAction } from "./actions";

const mocks = vi.hoisted(() => {
  const refresh = vi.fn();
  return { createCompanyAction: vi.fn(), saveCompanyViewAction: vi.fn(), deleteCompanyViewAction: vi.fn(), refresh, router: { refresh } };
});

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/auth/date-format-provider", () => ({ useDateFormat: () => "MDY" }));
vi.mock("./actions", () => ({
  addCompanyNoteAction: vi.fn(),
  archiveCompanyAction: vi.fn(),
  completeCompanyTaskAction: vi.fn(),
  createCompanyAction: mocks.createCompanyAction,
  createCompanyTaskAction: vi.fn(),
  logCompanyActivityAction: vi.fn(),
  toggleCompanyNotePinnedAction: vi.fn(),
  updateCompanyNoteAction: vi.fn(),
  deleteCompanyNoteAction: vi.fn(),
  updateCompanyActivityAction: vi.fn(),
  deleteCompanyActivityAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  uploadCompanyFileAction: vi.fn(),
}));
vi.mock("./saved-view-actions", () => ({
  saveCompanyViewAction: mocks.saveCompanyViewAction,
  deleteCompanyViewAction: mocks.deleteCompanyViewAction,
}));

const workspaceProps = {
  companies: [],
  matchedCount: 0,
  totalCount: 0,
  owners: [],
  search: "",
  ownerId: "",
  sort: "name_asc" as const,
  page: 1,
  savedViews: [{ id: "83d8aaf1-c78e-41db-ae18-493f44c84b42", name: "Named view", filters: { q: "Acme", ownerId: "" }, sort: "industry_desc" as const, visibleColumns: ["company", "owner"] as ("company" | "owner")[] }],
  activeViewId: "",
  visibleColumns: ["company", "industry", "contacts", "open_deals", "pipeline_value", "owner", "last_activity", "next_activity"] as ("company" | "industry" | "contacts" | "open_deals" | "pipeline_value" | "owner" | "last_activity" | "next_activity")[],
  canCreate: true,
  createIntent: false,
  canImport: false,
  canExport: false,
  canEditAll: false,
  canEditOwn: false,
  currentUserId: "user-1",
};

describe("CompaniesWorkspace create form", () => {
  it("opens from a create intent only when creation is permitted", () => {
    const { rerender } = render(<CompaniesWorkspace {...workspaceProps} createIntent />);
    expect(screen.getByRole("dialog", { name: "Add company" })).toBeInTheDocument();
    rerender(<CompaniesWorkspace {...workspaceProps} canCreate={false} createIntent />);
    expect(screen.queryByRole("dialog", { name: "Add company" })).not.toBeInTheDocument();
  });

  it("announces matches and offers an explicit add-anyway action", async () => {
    const user = userEvent.setup();
    mocks.createCompanyAction.mockResolvedValue({
      duplicateMatches: [{ id: "company-1", name: "Acme Group", website: "https://acme.example" }],
    });
    render(<CompaniesWorkspace {...workspaceProps} />);

    await user.click(screen.getAllByRole("button", { name: "Add company" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Add company" });
    await user.type(within(dialog).getByRole("textbox", { name: /Company name/ }), "Acme Group");
    await user.click(within(dialog).getByRole("button", { name: "Add company" }));

    const warning = await within(dialog).findByRole("status");
    expect(warning).toHaveTextContent("Acme Group");
    expect(warning).toHaveTextContent("https://acme.example");
    expect(within(dialog).getByRole("button", { name: "Add company anyway" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("CompaniesWorkspace saved views", () => {
  it("defaults to all eight company data columns and keeps an actions column", () => {
    render(<CompaniesWorkspace {...workspaceProps} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(9);
    expect(within(table).getByRole("columnheader", { name: "Next Activity" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("lets users choose visible company columns while keeping row actions available", async () => {
    const user = userEvent.setup();
    const company = {
      id: "company-1", workspace_id: "workspace-1", name: "Acme Group", website: "https://acme.example", industry: "Software",
      employee_size: null, phone: null, address_line_1: null, address_line_2: null, city: null, state: null, postal_code: null,
      country: null, description: null, owner_id: "user-1", created_at: "2026-04-01T12:00:00.000Z",
      updated_at: "2026-04-01T12:00:00.000Z", archived_at: null, ownerLabel: "Mina", contactsCount: 2,
      openDealsCount: 1, openPipelineValue: 1500, currency: "USD", lastActivity: null, nextActivity: null,
    };
    render(<CompaniesWorkspace {...workspaceProps} companies={[company]} matchedCount={1} totalCount={1} visibleColumns={["company"]} />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Company" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Industry" })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Acme Group" })).toHaveAttribute("href", "/app/companies/company-1");

    await user.click(screen.getByRole("checkbox", { name: "Industry" }));
    expect(within(table).getByRole("columnheader", { name: "Industry" })).toBeInTheDocument();
    expect(within(table).getByText("Software")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Saved view" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Named view" })).toBeInTheDocument();
  });
});

const companyNote = { id: "note-1", body: "Renewal discussion", is_pinned: true, created_by: "user-1", created_at: "2026-04-01T12:00:00.000Z" };
const companyDetail = {
  company: { id: "company-1", workspace_id: "workspace-1", name: "Acme Group", website: null, industry: null, employee_size: null, phone: null, address_line_1: null, address_line_2: null, city: null, state: null, postal_code: null, country: null, description: null, owner_id: "user-1", created_at: "2026-04-01T12:00:00.000Z", updated_at: "2026-04-01T12:00:00.000Z", archived_at: null },
  ownerLabel: "Mina",
  contacts: [], deals: [], activities: [], tasks: [], notes: [companyNote], attachments: [],
};
const companyNoteProps = { detail: companyDetail, owners: [], section: "notes", canEdit: true, canEditAll: false, canReassign: false, canArchive: false, currentUserId: "user-1" };

describe("CompanyDetailWorkspace owner editing", () => {
  it("offers the retained inactive owner as the selected option", () => {
    render(<CompanyDetailWorkspace {...companyNoteProps} canReassign owners={[{ id: "active-user", label: "Active user" }]} startEditing />);

    const owner = screen.getByRole("combobox", { name: "Owner" });
    expect(owner).toHaveValue("user-1");
    expect(within(owner).getByRole("option", { name: "Current owner · Inactive user" })).toHaveValue("user-1");
  });

  it("shows the inactive current owner and submits its stored ID when reassignment is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(updateCompanyAction).mockResolvedValueOnce({ ok: true });
    render(<CompanyDetailWorkspace
      {...companyNoteProps}
      canReassign={false}
      detail={{ ...companyDetail, ownerLabel: "Workspace member · 6d648c · Inactive user" }}
      owners={[]}
      startEditing
    />);

    const dialog = screen.getByRole("dialog", { name: "Edit company" });
    expect(within(dialog).getByRole("textbox", { name: "Owner" })).toHaveValue("Workspace member · 6d648c · Inactive user");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateCompanyAction).toHaveBeenCalledOnce());

    const submittedForm = vi.mocked(updateCompanyAction).mock.calls[0]?.[1] as FormData;
    expect(submittedForm.get("ownerId")).toBe("user-1");
  });
});

describe("CompanyDetailWorkspace note pinning", () => {
  it("shows pinned state and disables the unpin control while saving, then reports success and refreshes", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(toggleCompanyNotePinnedAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    mocks.refresh.mockClear();
    render(<CompanyDetailWorkspace {...companyNoteProps} />);

    expect(screen.getByLabelText("Pinned")).toHaveTextContent("Pinned");
    await user.click(screen.getByRole("button", { name: "Unpin note" }));
    expect(screen.getByRole("button", { name: "Unpin note" })).toBeDisabled();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    finishAction({ ok: true, message: "Note unpinned." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note unpinned.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("limits controls to editable notes and announces action errors", async () => {
    const user = userEvent.setup();
    const otherNote = { ...companyNote, created_by: "user-2", is_pinned: false };
    const { rerender } = render(<CompanyDetailWorkspace {...companyNoteProps} detail={{ ...companyDetail, notes: [otherNote] }} />);
    expect(screen.queryByRole("button", { name: "Pin note" })).not.toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...companyNoteProps} canEditAll detail={{ ...companyDetail, notes: [otherNote] }} />);
    vi.mocked(toggleCompanyNotePinnedAction).mockResolvedValueOnce({ message: "Note could not be updated." });
    await user.click(screen.getByRole("button", { name: "Pin note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note could not be updated.");

    rerender(<CompanyDetailWorkspace {...companyNoteProps} canEdit={false} detail={{ ...companyDetail, notes: [companyNote] }} />);
    expect(screen.queryByRole("button", { name: "Unpin note" })).not.toBeInTheDocument();
  });
});

describe("CompanyDetailWorkspace note editing and deletion", () => {
  it("edits a note inline with pending feedback, success status, and a refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(updateCompanyNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    mocks.refresh.mockClear();
    render(<CompanyDetailWorkspace {...companyNoteProps} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    const textbox = screen.getByRole("textbox", { name: "Edit note text" });
    expect(textbox).toHaveValue(companyNote.body);
    await user.clear(textbox);
    await user.type(textbox, "Renewal moved to May");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note updated." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note updated.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateCompanyNoteAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("companyId")).toBe(companyDetail.company.id);
    expect(submitted?.get("noteId")).toBe(companyNote.id);
    expect(submitted?.get("body")).toBe("Renewal moved to May");
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
  });

  it("keeps the editor open with an alert when saving fails and closes it on cancel without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(updateCompanyNoteAction).mockClear();
    vi.mocked(updateCompanyNoteAction).mockResolvedValueOnce({ message: "You can update only your own notes." });
    render(<CompanyDetailWorkspace {...companyNoteProps} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can update only your own notes.");
    expect(screen.getByRole("textbox", { name: "Edit note text" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
    expect(vi.mocked(updateCompanyNoteAction)).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before deleting a note and refreshes after success", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(deleteCompanyNoteAction).mockReset();
    vi.mocked(deleteCompanyNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    mocks.refresh.mockClear();
    render(<CompanyDetailWorkspace {...companyNoteProps} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(screen.getByText("Delete this note? This cannot be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep note" }));
    expect(vi.mocked(deleteCompanyNoteAction)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note deleted.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deleteCompanyNoteAction).mock.calls[0]?.[1].get("companyId")).toBe(companyDetail.company.id);
    expect(vi.mocked(deleteCompanyNoteAction).mock.calls[0]?.[1].get("noteId")).toBe(companyNote.id);
  });

  it("announces a delete failure while keeping the confirmation open", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteCompanyNoteAction).mockReset();
    vi.mocked(deleteCompanyNoteAction).mockResolvedValueOnce({ message: "Note could not be deleted. Refresh the company and try again." });
    render(<CompanyDetailWorkspace {...companyNoteProps} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note could not be deleted. Refresh the company and try again.");
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("shows edit and delete only for notes the user may modify", () => {
    const otherNote = { ...companyNote, created_by: "user-2" };
    const { rerender } = render(<CompanyDetailWorkspace {...companyNoteProps} detail={{ ...companyDetail, notes: [otherNote] }} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete note" })).not.toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...companyNoteProps} canEditAll detail={{ ...companyDetail, notes: [otherNote] }} />);
    expect(screen.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete note" })).toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...companyNoteProps} canEdit={false} canEditAll />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
  });
});

describe("CompanyDetailWorkspace activity editing and deletion", () => {
  const activity = { id: "activity-1", activity_type: "meeting", subject: "Renewal meeting", body: "Agreed on terms.", occurred_at: "2026-04-03T12:00:00.000Z", created_by: "user-1", is_system_event: false };
  const props = { ...companyNoteProps, section: "activity", detail: { ...companyDetail, activities: [activity] } };

  it("edits a manual activity inline and submits it with the company and activity ids", async () => {
    const user = userEvent.setup();
    vi.mocked(updateCompanyActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity updated." });
    mocks.refresh.mockClear();
    render(<CompanyDetailWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    await user.clear(screen.getByRole("textbox", { name: "Subject" }));
    await user.type(screen.getByRole("textbox", { name: "Subject" }), "Renewal signed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity updated.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateCompanyActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("companyId")).toBe(companyDetail.company.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
    expect(submitted?.get("subject")).toBe("Renewal signed");
  });

  it("requires confirmation before deleting an activity and submits the delete action", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteCompanyActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity deleted." });
    render(<CompanyDetailWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    expect(deleteCompanyActivityAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Activity deleted.");
    const submitted = vi.mocked(deleteCompanyActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("companyId")).toBe(companyDetail.company.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
  });

  it("shows edit and delete only for manual activities the user may modify", () => {
    const otherDetail = { ...companyDetail, activities: [{ ...activity, created_by: "user-2" }] };
    const { rerender } = render(<CompanyDetailWorkspace {...props} detail={otherDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...props} canEditAll detail={otherDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...props} canManageAllActivities detail={otherDetail} />);
    expect(screen.getByRole("button", { name: "Edit activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete activity" })).toBeInTheDocument();

    rerender(<CompanyDetailWorkspace {...props} canEdit={false} canManageAllActivities detail={otherDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
  });

  it("never offers controls on system events or system-generated activity types", () => {
    const systemDetail = { ...companyDetail, activities: [
      { ...activity, id: "activity-2", is_system_event: true },
      { ...activity, id: "activity-3", activity_type: "owner_changed", subject: "Company owner changed" },
    ] };
    render(<CompanyDetailWorkspace {...props} canManageAllActivities detail={systemDetail} />);
    expect(screen.getByText("Company owner changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete activity" })).not.toBeInTheDocument();
  });
});
