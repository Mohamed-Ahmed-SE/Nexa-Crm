import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompaniesWorkspace, CompanyDetailWorkspace } from "./companies-workspace";
import { toggleCompanyNotePinnedAction } from "./actions";

const mocks = vi.hoisted(() => ({ createCompanyAction: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/auth/date-format-provider", () => ({ useDateFormat: () => "MDY" }));
vi.mock("./actions", () => ({
  addCompanyNoteAction: vi.fn(),
  archiveCompanyAction: vi.fn(),
  completeCompanyTaskAction: vi.fn(),
  createCompanyAction: mocks.createCompanyAction,
  createCompanyTaskAction: vi.fn(),
  logCompanyActivityAction: vi.fn(),
  toggleCompanyNotePinnedAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  uploadCompanyFileAction: vi.fn(),
}));

const workspaceProps = {
  companies: [],
  matchedCount: 0,
  totalCount: 0,
  owners: [],
  search: "",
  ownerId: "",
  page: 1,
  canCreate: true,
  canImport: false,
  canExport: false,
  canEditAll: false,
  canEditOwn: false,
  currentUserId: "user-1",
};

describe("CompaniesWorkspace create form", () => {
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

const companyNote = { id: "note-1", body: "Renewal discussion", is_pinned: true, created_by: "user-1", created_at: "2026-04-01T12:00:00.000Z" };
const companyDetail = {
  company: { id: "company-1", workspace_id: "workspace-1", name: "Acme Group", website: null, industry: null, employee_size: null, phone: null, address_line_1: null, address_line_2: null, city: null, state: null, postal_code: null, country: null, description: null, owner_id: "user-1", created_at: "2026-04-01T12:00:00.000Z", updated_at: "2026-04-01T12:00:00.000Z", archived_at: null },
  ownerLabel: "Mina",
  contacts: [], deals: [], activities: [], tasks: [], notes: [companyNote], attachments: [],
};
const companyNoteProps = { detail: companyDetail, owners: [], section: "notes", canEdit: true, canEditAll: false, canReassign: false, canArchive: false, currentUserId: "user-1" };

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
