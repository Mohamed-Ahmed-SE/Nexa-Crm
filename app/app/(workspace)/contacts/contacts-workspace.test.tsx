import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContactListRow, ContactSavedView } from "@/lib/contacts/repository";
import type { ContactViewColumn } from "@/lib/contacts/schema";
import { ContactsWorkspace } from "./contacts-workspace";
import { archiveContactAction } from "./actions";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("./actions", () => ({
  addContactNoteAction: vi.fn(),
  archiveContactAction: vi.fn(),
  completeContactTaskAction: vi.fn(),
  createContactAction: vi.fn(),
  createContactTaskAction: vi.fn(),
  logContactActivityAction: vi.fn(),
  updateContactAction: vi.fn(),
  uploadContactFileAction: vi.fn(),
  saveContactViewAction: vi.fn(),
  deleteContactViewAction: vi.fn(),
}));

const populatedContact: ContactListRow = {
  id: "contact-1",
  workspace_id: "workspace-1",
  company_id: null,
  first_name: "Avery",
  last_name: "Chen",
  email: "avery@example.com",
  phone: "555-0142",
  job_title: "Operations Lead",
  linkedin_url: null,
  owner_id: null,
  lifecycle_status: "customer",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  company: null,
  lastActivity: "2026-03-30T12:00:00.000Z",
  nextActivity: "2026-04-10T12:00:00.000Z",
  tags: [{ id: "tag-1", name: "Strategic", color_token: null }, { id: "tag-2", name: "Product", color_token: null }],
};
const contactWithoutContext: ContactListRow = {
  ...populatedContact,
  id: "contact-2",
  first_name: "Jordan",
  last_name: "Lee",
  email: null,
  lastActivity: null,
  nextActivity: null,
  tags: [],
};

const workspaceProps = {
  contacts: [populatedContact, contactWithoutContext],
  companies: [],
  owners: [],
  canCreate: false,
  canImport: false,
  canExport: false,
  createIntent: false,
  canEditAll: false,
  canEditOwn: false,
  canArchive: false,
  canReassign: false,
  currentUserId: "user-1",
  search: "",
  lifecycle: "all",
  companyId: "",
  ownerId: "",
  page: 1,
  matchedCount: 2,
  totalCount: 2,
  activeCount: 0,
  customerCount: 1,
  sort: "updated_desc" as const,
  visibleColumns: ["name", "company", "job_title", "email", "phone", "owner", "lifecycle", "last_activity", "next_activity", "tags"] as ContactViewColumn[],
  savedViews: [{ id: "view-1", name: "Active Acme", filters: { q: "Acme", lifecycle: "active", companyId: "", ownerId: "" }, sort: "name_asc", visibleColumns: ["name", "lifecycle"] }] as ContactSavedView[],
  activeViewId: "view-1",
};

describe("ContactsWorkspace list context", () => {
  it("applies the selected view sort and visible columns to controls and table", () => {
    render(<ContactsWorkspace {...workspaceProps} visibleColumns={["name", "lifecycle"]} sort="name_asc" page={2} matchedCount={30} />);

    expect(screen.getByRole("combobox", { name: "Saved view" })).toHaveValue("view-1");
    expect(screen.getByRole("combobox", { name: "Sort contacts" })).toHaveValue("name_asc");
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Lifecycle" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.queryByText("avery@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("555-0142")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", expect.stringContaining("view=view-1"));

    fireEvent.change(screen.getByRole("combobox", { name: "Sort contacts" }), { target: { value: "updated_asc" } });
    expect(screen.getByRole("combobox", { name: "Saved view" })).toHaveValue("");
  });

  it("shows latest activity, next open task, and tags, with clear placeholders when absent", () => {
    render(<ContactsWorkspace {...workspaceProps} />);

    const populatedRow = screen.getByRole("row", { name: /Avery Chen/ });
    expect(populatedRow.querySelector<HTMLTimeElement>('[data-label="Last Activity"] time')?.dateTime).toBe(populatedContact.lastActivity);
    expect(populatedRow.querySelector<HTMLTimeElement>('[data-label="Next Activity"] time')?.dateTime).toBe(populatedContact.nextActivity);
    expect(within(populatedRow).getByText("Strategic")).toBeInTheDocument();
    expect(within(populatedRow).getByText("Product")).toBeInTheDocument();

    const emptyRow = screen.getByRole("row", { name: /Jordan Lee/ });
    expect(emptyRow.querySelector('[data-label="Last Activity"]')?.textContent).toBe("—");
    expect(emptyRow.querySelector('[data-label="Next Activity"]')?.textContent).toBe("—");
    expect(emptyRow.querySelector('[data-label="Tags"]')?.textContent).toBe("—");
  });
});

describe("ContactsWorkspace archiving", () => {
  it("gates archive by permission and cancels without submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(archiveContactAction).mockClear();
    const { rerender } = render(<ContactsWorkspace {...workspaceProps} />);
    expect(screen.queryByRole("button", { name: "Archive Avery Chen" })).not.toBeInTheDocument();

    rerender(<ContactsWorkspace {...workspaceProps} canArchive />);
    await user.click(screen.getByRole("button", { name: "Archive Avery Chen" }));
    const confirmation = screen.getByRole("alertdialog", { name: "Archive Avery Chen?" });
    expect(within(confirmation).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(archiveContactAction).not.toHaveBeenCalled();

    await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(archiveContactAction).not.toHaveBeenCalled();
  });

  it("keeps an actionable error and closes with a refresh after each distinct success", async () => {
    const user = userEvent.setup();
    const secondContact = { ...contactWithoutContext, id: "contact-3", first_name: "Morgan", last_name: "Chen" };
    routerMocks.refresh.mockClear();
    vi.mocked(archiveContactAction).mockReset()
      .mockResolvedValueOnce({ message: "Unable to archive this contact. Refresh the list and try again." })
      .mockResolvedValueOnce({ ok: true, message: "Contact archived." })
      .mockResolvedValueOnce({ ok: true, message: "Contact archived." });
    render(<ContactsWorkspace {...workspaceProps} canArchive contacts={[populatedContact, secondContact]} />);

    await user.click(screen.getByRole("button", { name: "Archive Avery Chen" }));
    let confirmation = screen.getByRole("alertdialog", { name: "Archive Avery Chen?" });
    await user.click(within(confirmation).getByRole("button", { name: "Archive contact" }));
    expect(await within(confirmation).findByRole("alert")).toHaveTextContent("Unable to archive this contact");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    await user.click(within(confirmation).getByRole("button", { name: "Archive contact" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(vi.mocked(archiveContactAction).mock.calls[1]?.[1].get("id")).toBe(populatedContact.id);

    await user.click(screen.getByRole("button", { name: "Archive Morgan Chen" }));
    confirmation = screen.getByRole("alertdialog", { name: "Archive Morgan Chen?" });
    await user.click(within(confirmation).getByRole("button", { name: "Archive contact" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(routerMocks.refresh).toHaveBeenCalledTimes(2);
    expect(vi.mocked(archiveContactAction).mock.calls[2]?.[1].get("id")).toBe(secondContact.id);
  });
});
