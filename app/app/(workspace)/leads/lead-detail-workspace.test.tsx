import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LeadDetail } from "@/lib/leads/repository";
import { LeadDetailWorkspace } from "./lead-detail-workspace";
import { deleteLeadActivityAction, deleteLeadNoteAction, updateLeadActivityAction, updateLeadNoteAction } from "./engagement-actions";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href as string} {...props}>{children}</a> }));
const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("./engagement-actions", () => ({ addLeadNoteAction: vi.fn(), logLeadActivityAction: vi.fn(), updateLeadNoteAction: vi.fn(), deleteLeadNoteAction: vi.fn(), updateLeadActivityAction: vi.fn(), deleteLeadActivityAction: vi.fn() }));
vi.mock("../tasks/actions", () => ({ createTaskAction: vi.fn() }));

const detail: LeadDetail = {
  lead: {
    id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084",
    full_name: "Taylor Reed",
    company_name: "Acme Systems",
    email: "taylor@example.test",
    phone: "+1 555 0100",
    job_title: "Operations Director",
    source_id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6",
    status: "qualified",
    owner_id: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2",
    estimated_value: 1250,
    currency: "USD",
    notes_summary: "Looking for a multi-year service agreement.",
    created_at: "2026-04-01T12:00:00Z",
    updated_at: "2026-04-02T12:00:00Z",
  },
  source: "Website",
  ownerLabel: "Workspace member · 6d648c",
  owners: [],
  activities: [],
  tasks: [],
  notes: [],
};

describe("LeadDetailWorkspace", () => {
  it("renders persisted lead fields and links back to Leads", () => {
    render(<LeadDetailWorkspace detail={detail} />);

    expect(screen.getByRole("heading", { name: "Taylor Reed" })).toBeInTheDocument();
    expect(screen.getByText("Acme Systems")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Workspace member · 6d648c")).toBeInTheDocument();
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "taylor@example.test" })).toHaveAttribute("href", "mailto:taylor@example.test");
    expect(screen.getByRole("link", { name: "+1 555 0100" })).toHaveAttribute("href", "tel:+1 555 0100");
    expect(screen.getByText("Operations Director")).toBeInTheDocument();
    expect(screen.getByText("Looking for a multi-year service agreement.")).toBeInTheDocument();
    expect(screen.getByText("04/01/2026")).toBeInTheDocument();
    expect(screen.getByText("04/02/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to Leads" })).toHaveAttribute("href", "/app/leads");
  });

  it("shows saved activities, follow-up tasks, and notes in the lead timeline", () => {
    render(<LeadDetailWorkspace detail={{
      ...detail,
      activities: [{ id: "activity-1", activity_type: "call", subject: "Discovery call", body: "Discussed timing.", occurred_at: "2026-04-03T12:00:00Z", created_by: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", is_system_event: false }],
      tasks: [{ id: "task-1", title: "Send proposal", description: null, task_type: "follow_up", status: "open", priority: "high", due_at: "2026-04-04T12:00:00Z", assigned_to: null }],
      notes: [{ id: "note-1", body: "Budget confirmed.", created_by: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", created_at: "2026-04-03T13:00:00Z", is_pinned: false }],
    }} />);

    expect(screen.getByRole("region", { name: "Lead activity timeline" })).toHaveTextContent("Discovery call");
    expect(screen.getByRole("region", { name: "Lead tasks" })).toHaveTextContent("Send proposal");
    expect(screen.getByRole("region", { name: "Lead notes" })).toHaveTextContent("Budget confirmed.");
  });

  it("offers engagement actions only to users allowed to edit this lead", () => {
    const { rerender } = render(<LeadDetailWorkspace canEdit={false} detail={detail} />);
    expect(screen.queryByText("Log activity")).not.toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit detail={detail} />);
    expect(screen.getByText("Log activity")).toBeInTheDocument();
    expect(screen.getByText("Add follow-up task")).toBeInTheDocument();
    expect(screen.getByText("Add note")).toBeInTheDocument();
  });

  it("omits unavailable optional facts instead of inventing values", () => {
    const missing = {
      ...detail,
      lead: { ...detail.lead, company_name: null, email: null, phone: null, job_title: null, source_id: null, notes_summary: null },
      source: null,
      ownerLabel: null,
    } satisfies LeadDetail;
    render(<LeadDetailWorkspace detail={missing} />);

    for (const label of ["Company", "Job title", "Email", "Phone", "Notes summary", "Owner", "Source"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByText("No additional information is recorded for this lead.")).toBeInTheDocument();
    expect(screen.getByText("No activity has been recorded for this lead yet.")).toBeInTheDocument();
    expect(screen.getByText("No notes have been added to this lead yet.")).toBeInTheDocument();
    expect(screen.getByText("No follow-up tasks have been created for this lead yet.")).toBeInTheDocument();
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
  });
});

describe("LeadDetailWorkspace note editing and deletion", () => {
  const creatorId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
  const note = { id: "note-1", body: "Budget confirmed.", created_by: creatorId, created_at: "2026-04-03T13:00:00Z", is_pinned: false };
  const noteDetail = { ...detail, notes: [note] };

  it("edits a note inline with pending feedback, success status, and a refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(updateLeadNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    routerMocks.refresh.mockClear();
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={noteDetail} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    const textbox = screen.getByRole("textbox", { name: "Edit note text" });
    expect(textbox).toHaveValue(note.body);
    await user.clear(textbox);
    await user.type(textbox, "Budget increased.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note updated." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateLeadNoteAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("leadId")).toBe(detail.lead.id);
    expect(submitted?.get("noteId")).toBe(note.id);
    expect(submitted?.get("body")).toBe("Budget increased.");
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
  });

  it("keeps the editor open with an alert when saving fails and closes it on cancel without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(updateLeadNoteAction).mockClear();
    vi.mocked(updateLeadNoteAction).mockResolvedValueOnce({ message: "You can update only your own notes." });
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={noteDetail} />);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can update only your own notes.");
    expect(screen.getByRole("textbox", { name: "Edit note text" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
    expect(vi.mocked(updateLeadNoteAction)).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before deleting a note and refreshes after success", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: { ok: boolean; message: string }) => void;
    vi.mocked(deleteLeadNoteAction).mockReset();
    vi.mocked(deleteLeadNoteAction).mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    routerMocks.refresh.mockClear();
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={noteDetail} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(screen.getByText("Delete this note? This cannot be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep note" }));
    expect(vi.mocked(deleteLeadNoteAction)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "Note deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("Note deleted.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deleteLeadNoteAction).mock.calls[0]?.[1].get("leadId")).toBe(detail.lead.id);
    expect(vi.mocked(deleteLeadNoteAction).mock.calls[0]?.[1].get("noteId")).toBe(note.id);
  });

  it("announces a delete failure while keeping the confirmation open", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteLeadNoteAction).mockReset();
    vi.mocked(deleteLeadNoteAction).mockResolvedValueOnce({ message: "Note could not be deleted. Refresh the lead and try again." });
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={noteDetail} />);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note could not be deleted. Refresh the lead and try again.");
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("shows edit and delete only for notes the user may modify", () => {
    const { rerender } = render(<LeadDetailWorkspace canEdit currentUserId="someone-else" detail={noteDetail} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete note" })).not.toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit canEditAll currentUserId="someone-else" detail={noteDetail} />);
    expect(screen.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete note" })).toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit={false} canEditAll currentUserId={creatorId} detail={noteDetail} />);
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
  });
});

describe("LeadDetailWorkspace activity editing and deletion", () => {
  const creatorId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
  const activity = { id: "activity-1", activity_type: "call", subject: "Discovery call", body: "Discussed timing.", occurred_at: "2026-04-03T12:00:00Z", created_by: creatorId, is_system_event: false };
  const activityDetail = { ...detail, activities: [activity] };
  const timeline = () => within(screen.getByRole("region", { name: "Lead activity timeline" }));

  it("edits a manual activity inline and submits it with the lead and activity ids", async () => {
    const user = userEvent.setup();
    vi.mocked(updateLeadActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity updated." });
    routerMocks.refresh.mockClear();
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={activityDetail} />);

    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    await user.clear(timeline().getByRole("textbox", { name: "Subject" }));
    await user.type(timeline().getByRole("textbox", { name: "Subject" }), "Pricing call");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Activity updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateLeadActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("leadId")).toBe(detail.lead.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
    expect(submitted?.get("subject")).toBe("Pricing call");
  });

  it("requires confirmation before deleting an activity and submits the delete action", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteLeadActivityAction).mockResolvedValueOnce({ ok: true, message: "Activity deleted." });
    render(<LeadDetailWorkspace canEdit currentUserId={creatorId} detail={activityDetail} />);

    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    expect(deleteLeadActivityAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Activity deleted.");
    const submitted = vi.mocked(deleteLeadActivityAction).mock.calls.at(-1)?.[1];
    expect(submitted?.get("leadId")).toBe(detail.lead.id);
    expect(submitted?.get("activityId")).toBe(activity.id);
  });

  it("shows edit and delete only for manual activities the user may modify", () => {
    const { rerender } = render(<LeadDetailWorkspace canEdit currentUserId="someone-else" detail={activityDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit canEditAll currentUserId="someone-else" detail={activityDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit canManageAllActivities currentUserId="someone-else" detail={activityDetail} />);
    expect(screen.getByRole("button", { name: "Edit activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete activity" })).toBeInTheDocument();

    rerender(<LeadDetailWorkspace canEdit={false} canManageAllActivities currentUserId={creatorId} detail={activityDetail} />);
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
  });

  it("never offers controls on system events or system-generated activity types", () => {
    render(<LeadDetailWorkspace canEdit canManageAllActivities currentUserId={creatorId} detail={{ ...detail, activities: [
      { ...activity, id: "activity-2", is_system_event: true },
      { ...activity, id: "activity-3", activity_type: "status_changed", subject: "Lead status changed" },
    ] }} />);
    expect(screen.getByText("Lead status changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete activity" })).not.toBeInTheDocument();
  });
});
