import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { Notification } from "@/lib/notifications/repository";
import { NotificationsWorkspace } from "./notifications-workspace";

vi.mock("@/lib/notifications/actions", () => ({
  loadNotificationsAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
}));

const unread: Notification = {
  id: "0a3aee7e-193d-4609-8153-c7d8f15ad111",
  notification_type: "lead_assigned",
  title: "Lead assigned to you",
  message: "Jordan Lee",
  related_entity_type: "lead",
  related_entity_id: "ad20e784-3811-4809-a630-62debe1cc333",
  task_id: null,
  created_at: "2026-04-05T12:00:00.000Z",
  read_at: null,
  href: "/app/leads/ad20e784-3811-4809-a630-62debe1cc333",
};
const read: Notification = {
  ...unread,
  id: "3e065f52-94f0-4609-a77d-bd6c49f67555",
  notification_type: "deal_won",
  title: "Deal won",
  message: "Northstar renewal",
  related_entity_type: "deal",
  related_entity_id: "868834e3-63e8-4440-8c94-79c63af4c0f0",
  read_at: "2026-04-05T12:30:00.000Z",
  href: "/app/deals/868834e3-63e8-4440-8c94-79c63af4c0f0",
};

beforeEach(() => vi.clearAllMocks());

describe("NotificationsWorkspace", () => {
  it("keeps a single main landmark when rendered inside the workspace shell", () => {
    vi.mocked(loadNotificationsAction).mockResolvedValue({ ok: true, notifications: [] });
    render(<main className="main-content"><NotificationsWorkspace /></main>);

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("shows the loading state while the inbox request is pending", () => {
    vi.mocked(loadNotificationsAction).mockReturnValue(new Promise(() => {}));
    render(<NotificationsWorkspace />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading notifications");
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the empty state when the inbox has no events", async () => {
    vi.mocked(loadNotificationsAction).mockResolvedValue({ ok: true, notifications: [] });
    render(<NotificationsWorkspace />);
    expect(await screen.findByRole("heading", { name: "You’re all caught up" })).toBeInTheDocument();
    expect(screen.getByText("New assignments, task reminders, and workspace updates will appear here.")).toBeInTheDocument();
  });

  it("links notifications to their record and marks one unread item as read", async () => {
    vi.mocked(loadNotificationsAction).mockResolvedValue({ ok: true, notifications: [unread, read] });
    vi.mocked(markNotificationReadAction).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NotificationsWorkspace />);

    const link = await screen.findByRole("link", { name: "Open lead" });
    expect(link).toHaveAttribute("href", "/app/leads/ad20e784-3811-4809-a630-62debe1cc333");
    const row = link.closest("li");
    expect(row).toHaveClass("is-unread");
    await user.click(within(row!).getByRole("button", { name: "Mark lead assigned to you as read" }));

    await waitFor(() => expect(within(row!).queryByRole("button", { name: /Mark .* as read/ })).not.toBeInTheDocument());
    expect(row).toHaveClass("is-read");
    expect(screen.getByText("You’re all caught up")).toBeInTheDocument();
  });

  it("opens task reminders through internal task search and leaves invites unlinked", async () => {
    vi.mocked(loadNotificationsAction).mockResolvedValue({ ok: true, notifications: [
      { ...unread, notification_type: "task_overdue", title: "Task overdue", message: "Quarterly follow-up", related_entity_type: null, related_entity_id: null, task_id: "85d644da-6f1c-4709-969a-b6ca20a5c211", href: "/app/tasks?q=Quarterly%20follow-up" },
      { ...read, notification_type: "invite_accepted", title: "Invitation accepted", related_entity_type: null, related_entity_id: null, task_id: null, href: null },
    ] });
    render(<NotificationsWorkspace />);

    expect(await screen.findByRole("link", { name: "Open task" })).toHaveAttribute("href", "/app/tasks?q=Quarterly%20follow-up");
    const invite = screen.getByText("Invitation accepted").closest("li");
    expect(within(invite!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks every unread notification as read", async () => {
    vi.mocked(loadNotificationsAction).mockResolvedValue({ ok: true, notifications: [unread, { ...unread, id: "e70dd682-f335-414e-aa8f-d80c3ea10770", title: "Task due today" }] });
    vi.mocked(markAllNotificationsReadAction).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NotificationsWorkspace />);

    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Mark .* as read/ })).not.toBeInTheDocument();
    expect(screen.getByText("You’re all caught up")).toBeInTheDocument();
  });

  it("recovers from an inbox load failure when the user retries", async () => {
    vi.mocked(loadNotificationsAction)
      .mockResolvedValueOnce({ ok: false, message: "Unable to load notifications." })
      .mockResolvedValue({ ok: true, notifications: [] });
    const user = userEvent.setup();
    render(<NotificationsWorkspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Notifications could not be loaded");
    expect(screen.getByText("Unable to load notifications.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "You’re all caught up" })).toBeInTheDocument();
  });
});
