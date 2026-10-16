import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContactListRow, ContactSavedView } from "@/lib/contacts/repository";
import type { ContactViewColumn } from "@/lib/contacts/schema";
import { ContactDetailWorkspace, ContactsWorkspace } from "./contacts-workspace";
import { archiveContactAction, createContactAction, deleteContactActivityAction, deleteContactFileAction, deleteContactNoteAction, toggleContactNotePinnedAction, updateContactAction, updateContactActivityAction, updateContactNoteAction } from "./actions";

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
  deleteContactFileAction: vi.fn(),
  toggleContactNotePinnedAction: vi.fn(),
  updateContactNoteAction: vi.fn(),
  deleteContactNoteAction: vi.fn(),
  updateContactActivityAction: vi.fn(),
  deleteContactActivityAction: vi.fn(),
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
  address: "12 Market St\nSuite 4",
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

const workspaceTags = [{ id: "tag-1", name: "Strategic", color_token: null }, { id: "tag-2", name: "Product", color_token: null }];

const workspaceProps = {
  contacts: [populatedContact, contactWithoutContext],
  companies: [],
  owners: [],
  tags: workspaceTags,
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
  tagId: "",
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

const ownNote = { id: "note-1", body: "Follow up next week", is_pinned: true, created_by: "user-1", created_at: "2026-04-01T12:00:00.000Z", updated_at: "2026-04-01T12:00:00.000Z" };
const detailProps = {
  contact: populatedContact, company: null, deals: [], activities: [], activityCount: 0, activityPage: 1, tasks: [], notes: [ownNote], attachments: [],
  owners: [], companies: [], tags: workspaceTags, canEdit: true, canEditAll: false, currentUserId: "user-1", canReassign: false, view: "overview",
};

describe("Contact address form persistence", () => {
  it("submits a new multiline address with the create-contact form", async () => {
    const user = userEvent.setup();
    vi.mocked(createContactAction).mockResolvedValueOnce({ ok: true, message: "Contact added." });
    render(<ContactsWorkspace {...workspaceProps} canCreate />);

    await user.click(screen.getByRole("button", { name: "Add Contact" }));
    await user.type(screen.getByRole("textbox", { name: "First name" }), "Sam");
    await user.type(screen.getByRole("textbox", { name: "Last name" }), "Rivera");
    await user.type(screen.getByRole("textbox", { name: "Address (optional)" }), "12 Market St\nSuite 4");
    await user.click(screen.getByRole("button", { name: "Add contact" }));

    await waitFor(() => expect(createContactAction).toHaveBeenCalled());
    expect(vi.mocked(createContactAction).mock.calls.at(-1)?.[1].get("address")).toBe("12 Market St\nSuite 4");
  });

  it("loads and submits the existing address from the edit form and displays it in detail", async () => {
    const user = userEvent.setup();
    vi.mocked(updateContactAction).mockResolvedValueOnce({ ok: true, message: "Contact updated." });
    render(<ContactDetailWorkspace {...detailProps} />);

    expect(screen.getByText("Address").parentElement).toHaveTextContent("12 Market St Suite 4");
    await user.click(screen.getByRole("button", { name: "Edit Contact" }));
    const address = screen.getByRole("textbox", { name: "Address (optional)" });
    expect(address).toHaveValue("12 Market St\nSuite 4");
    await user.clear(address);
    await user.type(address, "Updated location");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateContactAction).toHaveBeenCalled());
    expect(vi.mocked(updateContactAction).mock.calls.at(-1)?.[1].get("address")).toBe("Updated location");
  });
});

describe("ContactDetailWorkspace owner editing", () => {
  it("keeps the inactive historical owner selected with the required marker", async () => {
    const user = userEvent.setup();
    render(<ContactDetailWorkspace {...detailProps} contact={{ ...populatedContact, owner_id: "inactive-user" }} owners={[{ id: "active-user", label: "Active user" }]} canReassign />);

    await user.click(screen.getByRole("button", { name: "Edit contact information" }));
    const owner = screen.getByRole("combobox", { name: "Owner" });
    expect(owner).toHaveValue("inactive-user");
    expect(within(owner).getByRole("option", { name: "Current owner · Inactive user" })).toHaveValue("inactive-user");
  });
});

describe("ContactDetailWorkspace note pinning", () => {
  it("shows pinned state and lets an editor unpin their note with success feedback and refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(toggleContactNotePinnedAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    routerMocks.refresh.mockClear();
    render(<ContactDetailWorkspace {...detailProps} />);

    expect(screen.getByLabelText("Pinned")).toHaveTextContent("Pinned");
    const pinButton = screen.getByRole("button", { name: "Unpin note" });
    await user.click(pinButton);
    expect(screen.getByRole("button", { name: "Unpin note" })).toBeDisabled();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    finishAction({ ok: true, message: "Note unpinned." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note unpinned.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toggleContactNotePinnedAction).mock.calls[0]?.[1].get("contactId")).toBe(populatedContact.id);
    expect(vi.mocked(toggleContactNotePinnedAction).mock.calls[0]?.[1].get("noteId")).toBe(ownNote.id);
  });

  it("hides pin controls for another creator’s note when the editor lacks crm.edit.all", () => {
    const otherNote = { ...ownNote, created_by: "user-2", is_pinned: false };
    render(<ContactDetailWorkspace {...detailProps} notes={[otherNote]} />);

    expect(screen.queryByRole("button", { name: "Pin note" })).not.toBeInTheDocument();
  });

  it("hides pin controls for a read-only user", () => {
    render(<ContactDetailWorkspace {...detailProps} canEdit={false} />);

    expect(screen.queryByRole("button", { name: "Unpin note" })).not.toBeInTheDocument();
  });

  it("announces the server action error when unpinning a note fails", async () => {
    const user = userEvent.setup();
    vi.mocked(toggleContactNotePinnedAction).mockResolvedValueOnce({ message: "You can update only your own notes." });
    render(<ContactDetailWorkspace {...detailProps} canEditAll />);

    await user.click(screen.getByRole("button", { name: "Unpin note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can update only your own notes.");
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

describe("ContactDetailWorkspace note editing and deletion", () => {
  it("edits a note inline with pending feedback, success status, and a refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(updateContactNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    routerMocks.refresh.mockClear();
    render(<ContactDetailWorkspace {...detailProps} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    const textbox = screen.getByRole("textbox", { name: "Edit note text" });
    expect(textbox).toHaveValue(ownNote.body);
    await user.clear(textbox);
    await user.type(textbox, "Call on Friday");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note updated." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateContactNoteAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("contactId")).toBe(populatedContact.id);
    expect(submitted?.get("noteId")).toBe(ownNote.id);
    expect(submitted?.get("body")).toBe("Call on Friday");
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
  });

  it("keeps the editor open with an alert when saving fails and closes it on cancel without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(updateContactNoteAction).mockClear();
    vi.mocked(updateContactNoteAction).mockResolvedValueOnce({ message: "You can update only your own notes." });
    render(<ContactDetailWorkspace {...detailProps} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can update only your own notes.");
    expect(screen.getByRole("textbox", { name: "Edit note text" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
    expect(vi.mocked(updateContactNoteAction)).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before deleting a note and refreshes after success", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(deleteContactNoteAction).mockReset();
    vi.mocked(deleteContactNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    routerMocks.refresh.mockClear();
    render(<ContactDetailWorkspace {...detailProps} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(screen.getByText("Delete this note? This cannot be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep note" }));
    expect(vi.mocked(deleteContactNoteAction)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note deleted.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deleteContactNoteAction).mock.calls[0]?.[1].get("contactId")).toBe(populatedContact.id);
    expect(vi.mocked(deleteContactNoteAction).mock.calls[0]?.[1].get("noteId")).toBe(ownNote.id);
  });

  it("announces a delete failure while keeping the confirmation open", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteContactNoteAction).mockReset();
    vi.mocked(deleteContactNoteAction).mockResolvedValueOnce({ message: "Note could not be deleted. Refresh the contact and try again." });
    render(<ContactDetailWorkspace {...detailProps} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note could not be deleted. Refresh the contact and try again.");
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("shows edit and delete only for notes the user may modify", () => {
    const otherNote = { ...ownNote, created_by: "user-2" };
    const { rerender } = render(<ContactDetailWorkspace {...detailProps} notes={[otherNote]} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete note" })).not.toBeInTheDocument();

    rerender(<ContactDetailWorkspace {...detailProps} canEditAll notes={[otherNote]} />);
    expect(screen.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete note" })).toBeInTheDocument();

    rerender(<ContactDetailWorkspace {...detailProps} canEdit={false} canEditAll />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
  });
});

describe("ContactDetailWorkspace activity editing and deletion", () => {
  const activity = { id: "activity-1", activity_type: "call", subject: "Discovery call", body: "Discussed timing.", occurred_at: "2026-04-03T12:00:00.000Z", created_by: "user-1", owner_id: "user-1", is_system_event: false };

  it("edits a manual activity inline and submits it with the contact and activity ids", async () => {
    const user = userEvent.setup();
    vi.mocked(updateContactActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity updated." });
    routerMocks.refresh.mockClear();
    render(<ContactDetailWorkspace {...detailProps} activities={[activity]} />);

    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    await user.clear(screen.getByRole("textbox", { name: "Subject" }));
    await user.type(screen.getByRole("textbox", { name: "Subject" }), "Renewal call");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateContactActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("contactId")).toBe(populatedContact.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
    expect(submitted?.get("subject")).toBe("Renewal call");
  });

  it("requires confirmation before deleting an activity and submits the delete action", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteContactActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity deleted." });
    render(<ContactDetailWorkspace {...detailProps} activities={[activity]} />);

    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    expect(deleteContactActivityAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Activity deleted.");
    const submitted = vi.mocked(deleteContactActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("contactId")).toBe(populatedContact.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
  });

  it("shows edit and delete only for manual activities the user may modify", () => {
    const otherActivity = { ...activity, created_by: "user-2" };
    const { rerender } = render(<ContactDetailWorkspace {...detailProps} activities={[otherActivity]} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<ContactDetailWorkspace {...detailProps} canEditAll activities={[otherActivity]} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<ContactDetailWorkspace {...detailProps} canManageAllActivities activities={[otherActivity]} />);
    expect(screen.getByRole("button", { name: "Edit activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete activity" })).toBeInTheDocument();

    rerender(<ContactDetailWorkspace {...detailProps} canEdit={false} canManageAllActivities activities={[otherActivity]} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
  });

  it("never offers controls on system events or system-generated activity types", () => {
    render(<ContactDetailWorkspace {...detailProps} canManageAllActivities activities={[
      { ...activity, id: "activity-2", is_system_event: true },
      { ...activity, id: "activity-3", activity_type: "owner_changed", subject: "Contact owner changed" },
    ]} />);
    expect(screen.getByText("Contact owner changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete activity" })).not.toBeInTheDocument();
  });
});

const attachment = { id: "file-1", filename: "proposal.pdf", mime_type: "application/pdf", size_bytes: 2048, uploaded_by: "user-1", created_at: "2026-04-01T12:00:00.000Z", storage_path: "workspace-1/contact-1/file-1-proposal.pdf" };

describe("Contact files", () => {
  it("lists files with a download link and a working file count, and nothing for an empty list", () => {
    const { rerender } = render(<ContactDetailWorkspace {...detailProps} attachments={[attachment]} view="files" />);
    expect(screen.getByRole("heading", { name: "Files (1)" })).toBeInTheDocument();
    expect(screen.getByText("proposal.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", `/app/contacts/files/${attachment.id}`);

    rerender(<ContactDetailWorkspace {...detailProps} attachments={[]} view="files" />);
    expect(screen.getByRole("heading", { name: "Files (0)" })).toBeInTheDocument();
    expect(screen.getByText("No files yet")).toBeInTheDocument();
  });

  it("deletes a file after confirmation and refreshes", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(deleteContactFileAction).mockReset();
    vi.mocked(deleteContactFileAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    const refreshCallsBefore = routerMocks.refresh.mock.calls.length;
    render(<ContactDetailWorkspace {...detailProps} attachments={[attachment]} view="files" />);

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    await user.click(screen.getByRole("button", { name: "Keep file" }));
    expect(vi.mocked(deleteContactFileAction)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "File deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("File deleted.");
    await waitFor(() => expect(routerMocks.refresh.mock.calls.length).toBe(refreshCallsBefore + 1));
    expect(vi.mocked(deleteContactFileAction).mock.calls[0]?.[1].get("contactId")).toBe(populatedContact.id);
    expect(vi.mocked(deleteContactFileAction).mock.calls[0]?.[1].get("fileId")).toBe(attachment.id);
  });

  it("hides the delete control when the user cannot edit the contact", () => {
    render(<ContactDetailWorkspace {...detailProps} attachments={[attachment]} canEdit={false} view="files" />);
    expect(screen.queryByRole("button", { name: "Delete proposal.pdf" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();
  });
});
