import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveDealAction, markDealWonAction, reopenDealAction } from "../actions";
import type { DealDetail } from "@/lib/deals/repository";
import { DealDetailWorkspace } from "./deal-detail-workspace";
import { deleteDealNoteAction, updateDealNoteAction } from "./engagement-actions";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("../actions", () => ({ archiveDealAction: vi.fn(), markDealLostAction: vi.fn(), markDealWonAction: vi.fn(), reopenDealAction: vi.fn() }));
vi.mock("./engagement-actions", () => ({ addDealNoteAction: vi.fn(), createDealFollowUpTaskAction: vi.fn(), logDealActivityAction: vi.fn(), toggleDealNotePinAction: vi.fn(), updateDealNoteAction: vi.fn(), deleteDealNoteAction: vi.fn() }));
vi.mock("./file-actions", () => ({ uploadDealFileAction: vi.fn() }));

const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});
beforeEach(() => vi.clearAllMocks());

const dealDetail: DealDetail = {
  deal: {
    id: "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79",
    pipeline_id: "d47140c3-6c0f-4277-ae4e-7b2c29aef382",
    stage_id: "8dc80d75-85b6-4c7e-a30f-210250b8384c",
    title: "Platform rollout",
    company_id: "012be84b-6794-4e6a-a149-8d92c0a4d110",
    primary_contact_id: "7f55aecc-8873-47ab-bcdd-d921fe5e6edc",
    amount: 125000,
    currency: "USD",
    probability: 75,
    expected_close_date: "2027-01-15",
    owner_id: "c2155412-d8a0-4792-b2bc-f6064b2798f4",
    source_id: null,
    priority: "high",
    description: "Roll out the platform across regional teams.",
    status: "open",
    created_at: "2026-04-01T10:30:00.000Z",
    updated_at: "2026-04-03T15:45:00.000Z",
  },
  company: { id: "012be84b-6794-4e6a-a149-8d92c0a4d110", name: "Northstar Labs" },
  contact: { id: "7f55aecc-8873-47ab-bcdd-d921fe5e6edc", full_name: "Sam Rivera" },
  stage: { id: "8dc80d75-85b6-4c7e-a30f-210250b8384c", name: "Negotiation", stage_type: "open" },
  pipeline: { id: "d47140c3-6c0f-4277-ae4e-7b2c29aef382", name: "New Business" },
  ownerLabel: "Jordan Lee",
  source: null,
  tags: [{ id: "tag-priority", name: "Strategic", color_token: null }],
  lostReasons: [{ id: "d4d9669e-df9f-4f7d-a392-cb187ffb8d13", name: "Budget" }],
  openStages: [{ id: "8dc80d75-85b6-4c7e-a30f-210250b8384c", name: "Negotiation", position: 4 }],
  activities: [{ id: "7f0197d1-c623-4602-b6db-a36e9ddad8b8", activity_type: "deal_lost", subject: "Deal marked lost", body: "Lost reason: Budget", occurred_at: "2026-04-03T15:45:00.000Z" }],
  tasks: [{ id: "21f0bd93-83e0-4bca-aee7-00e9642305ac", title: "Send proposal", description: "Include pricing", task_type: "follow_up", status: "open", priority: "high", due_at: "2026-04-04T15:00:00.000Z", assigned_to: null }],
  notes: [{ id: "e75c8819-b731-46e6-8443-91fa11a4ee58", body: "Pricing approved.", created_by: "c2155412-d8a0-4792-b2bc-f6064b2798f4", author: "Jordan Lee", created_at: "2026-04-03T14:00:00.000Z", updated_at: "2026-04-03T15:00:00.000Z", is_pinned: false }],
  attachments: [{ id: "3f73ca78-1538-4e41-92bb-684affd25a01", filename: "proposal.pdf", mime_type: "application/pdf", size_bytes: 24576, created_at: "2026-04-03T15:30:00.000Z" }],
};

describe("DealDetailWorkspace", () => {
  it("shows archive only with permission and requires confirmation before archiving", () => {
    const { rerender } = render(<DealDetailWorkspace canArchive={false} canEdit detail={dealDetail} />);
    expect(screen.queryByRole("button", { name: "Archive deal" })).not.toBeInTheDocument();

    rerender(<DealDetailWorkspace canArchive canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive deal" }));
    const dialog = screen.getByRole("alertdialog", { name: "Archive Platform rollout?" });
    expect(within(dialog).getByText(/removed from the active deals list/)).toBeInTheDocument();
    expect(archiveDealAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(archiveDealAction).not.toHaveBeenCalled();
  });

  it("archives after confirmation and returns to the deal list", async () => {
    vi.mocked(archiveDealAction).mockResolvedValue({ ok: true, message: "Deal archived." });
    render(<DealDetailWorkspace canArchive canEdit detail={dealDetail} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive deal" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archive deal" }));

    await waitFor(() => expect(archiveDealAction).toHaveBeenCalledOnce());
    expect(vi.mocked(archiveDealAction).mock.calls[0]?.[0].get("id")).toBe(dealDetail.deal.id);
    await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith("/app/deals"));
  });

  it("keeps the dialog open and shows action failures for retry", async () => {
    vi.mocked(archiveDealAction).mockResolvedValue({ ok: false, message: "Deal not found or already archived." });
    render(<DealDetailWorkspace canArchive canEdit detail={dealDetail} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive deal" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archive deal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deal not found or already archived.");
    expect(screen.getByRole("alertdialog", { name: "Archive Platform rollout?" })).toBeInTheDocument();
    expect(routerMocks.push).not.toHaveBeenCalled();
  });
  it("shows persisted deal overview fields and linked company and contact", () => {
    const { container } = render(<DealDetailWorkspace canEdit detail={dealDetail} />);

    expect(screen.getByRole("heading", { level: 1, name: "Platform rollout" })).toBeInTheDocument();
    expect(screen.getByText("Roll out the platform across regional teams.")).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "Deal overview" });
    expect(overview).toHaveTextContent("125,000");
    expect(overview).toHaveTextContent("75%");
    expect(overview).toHaveTextContent("Negotiation");
    expect(screen.getByText("Tags").parentElement).toHaveTextContent("Strategic");
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("group", { name: "Deal outcome actions" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Activity timeline" })).toHaveTextContent("Lost reason: Budget");

    const relationships = screen.getByRole("region", { name: "Overview" });
    expect(within(relationships).getByRole("link", { name: "Northstar Labs" })).toHaveAttribute("href", "/app/companies/012be84b-6794-4e6a-a149-8d92c0a4d110");
    expect(within(relationships).getByRole("link", { name: "Sam Rivera" })).toHaveAttribute("href", "/app/contacts/7f55aecc-8873-47ab-bcdd-d921fe5e6edc");
    expect(within(relationships).getByRole("link", { name: "1 file" })).toHaveAttribute("href", "#deal-files");
  });

  it("lists related files with metadata and offers upload only to editors", () => {
    const { unmount } = render(<DealDetailWorkspace canEdit detail={dealDetail} />);

    const files = screen.getByRole("region", { name: "Files" });
    expect(within(files).getByRole("link", { name: "proposal.pdf" })).toHaveAttribute("href", "/app/deals/files/3f73ca78-1538-4e41-92bb-684affd25a01");
    expect(files).toHaveTextContent("application/pdf · 24.0 KB");
    expect(within(files).getByLabelText("Upload a file")).toBeInTheDocument();

    unmount();
    render(<DealDetailWorkspace canEdit={false} detail={dealDetail} />);
    expect(screen.getByRole("region", { name: "Files" })).toHaveTextContent("proposal.pdf");
    expect(screen.queryByLabelText("Upload a file")).not.toBeInTheDocument();
  });

  it("renders related deal notes, follow-up tasks, and engagement actions", () => {
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);

    expect(screen.getByRole("region", { name: "Activity timeline" })).toHaveTextContent("Deal marked lost");
    const notes = screen.getByRole("region", { name: "Notes" });
    expect(notes).toHaveTextContent("Pricing approved.");
    expect(notes).toHaveTextContent("By Jordan Lee");
    expect(notes).toHaveTextContent("Created");
    expect(notes).toHaveTextContent("Updated");
    expect(within(notes).getByRole("button", { name: "Pin note" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Follow-up tasks" })).toHaveTextContent("Send proposal");
    expect(screen.getByRole("region", { name: "Follow-up tasks" })).toHaveTextContent("open");
    expect(screen.getByRole("region", { name: "Deal engagement" })).toHaveTextContent("Log activity");
    expect(screen.getByRole("region", { name: "Deal engagement" })).toHaveTextContent("Add follow-up task");
    expect(screen.getByRole("region", { name: "Deal engagement" })).toHaveTextContent("Add note");
  });

  it("puts pinned notes first and hides pin controls from users without edit permission", () => {
    const notes = [
      { ...dealDetail.notes[0], id: "6fd74499-e014-4797-a2a9-f66d4a2b7f57", body: "Pinned detail.", created_at: "2026-04-02T14:00:00.000Z", updated_at: "2026-04-02T14:00:00.000Z", is_pinned: true },
      ...dealDetail.notes,
    ];
    const { rerender } = render(<DealDetailWorkspace canEdit detail={{ ...dealDetail, notes }} />);
    const articles = within(screen.getByRole("region", { name: "Notes" })).getAllByRole("article");
    expect(articles[0]).toHaveTextContent("Pinned detail.");
    expect(within(articles[0]).getByRole("button", { name: "Unpin note" })).toBeInTheDocument();
    expect(within(articles[1]).getByRole("button", { name: "Pin note" })).toBeInTheDocument();

    rerender(<DealDetailWorkspace canEdit={false} detail={{ ...dealDetail, notes }} />);
    expect(within(screen.getByRole("region", { name: "Notes" })).queryByRole("button", { name: "Unpin note" })).not.toBeInTheDocument();
  });

  it("hides engagement mutations from users who cannot edit the deal", () => {
    render(<DealDetailWorkspace canEdit={false} detail={dealDetail} />);

    const engagement = screen.getByRole("region", { name: "Deal engagement" });
    expect(engagement).toHaveTextContent("Engagement actions are unavailable because you cannot edit this deal.");
    expect(within(engagement).queryByText("Log activity")).not.toBeInTheDocument();
  });

  it("omits task creation for a closed deal while preserving its tasks", () => {
    const closedDetail = { ...dealDetail, deal: { ...dealDetail.deal, status: "lost" as const } };
    render(<DealDetailWorkspace canEdit detail={closedDetail} />);

    const engagement = screen.getByRole("region", { name: "Deal engagement" });
    expect(engagement).not.toHaveTextContent("Add follow-up task");
    expect(screen.getByRole("region", { name: "Follow-up tasks" })).toHaveTextContent("Send proposal");
  });

  it("shows explicit fallbacks when no company or primary contact is linked", () => {
    render(<DealDetailWorkspace canEdit detail={{ ...dealDetail, company: null, contact: null }} />);

    const overview = screen.getByRole("region", { name: "Overview" });
    expect(within(overview).getByText("No company linked")).toBeInTheDocument();
    expect(within(overview).getByText("No primary contact")).toBeInTheDocument();
    expect(within(overview).queryByRole("link", { name: "Northstar Labs" })).not.toBeInTheDocument();
    expect(within(overview).queryByRole("link", { name: "Sam Rivera" })).not.toBeInTheDocument();
  });

  it("requires a lost reason and explicit handling for open tasks", async () => {
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Lost" }));

    const dialog = await screen.findByRole("dialog", { name: "Mark deal lost" });
    expect(within(dialog).getByRole("combobox", { name: "Lost reason" })).toBeRequired();
    expect(within(dialog).getByRole("combobox", { name: "Related open tasks" })).toBeRequired();
    expect(within(dialog).getByRole("option", { name: "Keep open" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Mark complete" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers the final value and won date before closing an open deal", async () => {
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));

    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    expect(within(dialog).getByRole("spinbutton", { name: "Final amount" })).toHaveValue(125000);
    expect(within(dialog).getByLabelText("Won date")).toHaveValue("2027-01-15");
  });

  it("shows server validation failures without closing the outcome dialog", async () => {
    vi.mocked(markDealWonAction).mockResolvedValue({ ok: false, message: "The deal could not be marked won." });
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The deal could not be marked won.");
  });

  it("shows a recoverable message when the server action request rejects", async () => {
    vi.mocked(markDealWonAction).mockRejectedValue(new Error("network unavailable"));
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The request could not be completed. Check your connection and try again.");
  });

  it("closes the dialog and shows success feedback after an outcome completes", async () => {
    vi.mocked(markDealWonAction).mockResolvedValue({ ok: true, message: "Deal marked won." });
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Deal marked won.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets a closed deal reopen into an active open stage", async () => {
    vi.mocked(reopenDealAction).mockResolvedValue({ ok: true, message: "Deal reopened." });
    const closedDetail = { ...dealDetail, deal: { ...dealDetail.deal, status: "lost" as const }, stage: { ...dealDetail.stage!, stage_type: "lost" as const } };
    render(<DealDetailWorkspace canEdit detail={closedDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen deal" }));

    const dialog = await screen.findByRole("dialog", { name: "Reopen deal" });
    expect(within(dialog).getByRole("combobox", { name: "Reopen in stage" })).toHaveValue("8dc80d75-85b6-4c7e-a30f-210250b8384c");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen deal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deal reopened.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables outcome changes for users who cannot edit this deal", () => {
    render(<DealDetailWorkspace canEdit={false} detail={dealDetail} />);

    expect(screen.getByRole("button", { name: "Mark Won" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Lost" })).toBeDisabled();
    expect(screen.getByText("Outcome changes are unavailable because you cannot edit this deal.")).toBeInTheDocument();
  });
});

describe("DealDetailWorkspace note editing and deletion", () => {
  const note = dealDetail.notes[0];
  const creatorId = note.created_by;
  const noteRegion = () => within(screen.getByRole("region", { name: "Notes" }));

  it("edits a note inline with pending feedback, success status, and a refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(updateDealNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    render(<DealDetailWorkspace canEdit currentUserId={creatorId} detail={dealDetail} />);

    await user.click(noteRegion().getByRole("button", { name: "Edit note" }));
    const textbox = noteRegion().getByRole("textbox", { name: "Edit note text" });
    expect(textbox).toHaveValue(note.body);
    await user.clear(textbox);
    await user.type(textbox, "Pricing re-approved.");
    await user.click(noteRegion().getByRole("button", { name: "Save changes" }));

    expect(noteRegion().getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note updated." });
    expect(await noteRegion().findByRole("status")).toHaveTextContent("Note updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateDealNoteAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("dealId")).toBe(dealDetail.deal.id);
    expect(submitted?.get("noteId")).toBe(note.id);
    expect(submitted?.get("body")).toBe("Pricing re-approved.");
    expect(noteRegion().queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
  });

  it("keeps the editor open with an alert when saving fails and closes it on cancel without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(updateDealNoteAction).mockResolvedValueOnce({ message: "You can update only your own notes." });
    render(<DealDetailWorkspace canEdit currentUserId={creatorId} detail={dealDetail} />);

    await user.click(noteRegion().getByRole("button", { name: "Edit note" }));
    await user.click(noteRegion().getByRole("button", { name: "Save changes" }));
    expect(await noteRegion().findByRole("alert")).toHaveTextContent("You can update only your own notes.");
    expect(noteRegion().getByRole("textbox", { name: "Edit note text" })).toBeInTheDocument();

    await user.click(noteRegion().getByRole("button", { name: "Cancel" }));
    expect(noteRegion().queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
    expect(vi.mocked(updateDealNoteAction)).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before deleting a note and refreshes after success", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(deleteDealNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    render(<DealDetailWorkspace canEdit currentUserId={creatorId} detail={dealDetail} />);

    await user.click(noteRegion().getByRole("button", { name: "Delete note" }));
    expect(noteRegion().getByText("Delete this note? This cannot be undone.")).toBeInTheDocument();
    await user.click(noteRegion().getByRole("button", { name: "Keep note" }));
    expect(vi.mocked(deleteDealNoteAction)).not.toHaveBeenCalled();

    await user.click(noteRegion().getByRole("button", { name: "Delete note" }));
    await user.click(noteRegion().getByRole("button", { name: "Confirm delete" }));
    expect(noteRegion().getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note deleted." });
    expect(await noteRegion().findByRole("status")).toHaveTextContent("Note deleted.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deleteDealNoteAction).mock.calls[0]?.[1].get("dealId")).toBe(dealDetail.deal.id);
    expect(vi.mocked(deleteDealNoteAction).mock.calls[0]?.[1].get("noteId")).toBe(note.id);
  });

  it("announces a delete failure while keeping the confirmation open", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteDealNoteAction).mockResolvedValueOnce({ message: "Note could not be deleted. Refresh the deal and try again." });
    render(<DealDetailWorkspace canEdit currentUserId={creatorId} detail={dealDetail} />);

    await user.click(noteRegion().getByRole("button", { name: "Delete note" }));
    await user.click(noteRegion().getByRole("button", { name: "Confirm delete" }));
    expect(await noteRegion().findByRole("alert")).toHaveTextContent("Note could not be deleted. Refresh the deal and try again.");
    expect(noteRegion().getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("shows edit and delete only for notes the user may modify", () => {
    const { rerender } = render(<DealDetailWorkspace canEdit currentUserId="someone-else" detail={dealDetail} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete note" })).not.toBeInTheDocument();

    rerender(<DealDetailWorkspace canEdit canEditAll currentUserId="someone-else" detail={dealDetail} />);
    expect(screen.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete note" })).toBeInTheDocument();

    rerender(<DealDetailWorkspace canEdit={false} canEditAll currentUserId={creatorId} detail={dealDetail} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
  });
});
