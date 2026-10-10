import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createTaskAction, rescheduleTaskAction } from "./actions";
import { TasksWorkspace } from "./tasks-workspace";
import TasksError from "./error";
import type { TaskRow } from "@/lib/tasks/repository";
import type { TaskSearchParams } from "@/lib/tasks/schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("./actions", () => ({ completeTaskAction: vi.fn(), createTaskAction: vi.fn(), rescheduleTaskAction: vi.fn() }));

const task: TaskRow = {
  id: "c2155412-d8a0-4792-b2bc-f6064b2798f4", title: "Send revised proposal", description: "Include the support scope.", task_type: "email",
  status: "open", priority: "high", due_at: "2026-04-05T14:30:00.000Z", assigned_to: "c2155412-d8a0-4792-b2bc-f6064b2798f4",
  created_by: "c2155412-d8a0-4792-b2bc-f6064b2798f4", related_entity_type: "company", related_entity_id: "012be84b-6794-4e6a-a149-8d92c0a4d110",
  completed_at: null, relation: { id: "012be84b-6794-4e6a-a149-8d92c0a4d110", type: "company", label: "Northstar Labs" },
};
const props = { tasks: [task], owners: [{ id: task.assigned_to!, label: "You" }], options: [], matchedCount: 1, params: { view: "my", q: "", type: "all", priority: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 } as TaskSearchParams, canCreate: true, canEdit: true, canReassign: false, canExport: true, currentUserId: task.assigned_to! };

describe("TasksWorkspace", () => {
  it("renders persisted task fields, valid relation link, filters, and quick-completion action", () => {
    render(<TasksWorkspace {...props} />);
    const row = screen.getByRole("row", { name: /Email Send revised proposal/ });
    expect(within(row).getByText("Include the support scope.")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Northstar Labs" })).toHaveAttribute("href", "/app/companies/012be84b-6794-4e6a-a149-8d92c0a4d110");
    expect(within(row).getByText("You")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Complete Send revised proposal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("combobox", { name: "Filter by priority" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort tasks" })).toHaveValue("due_date");
  });

  it("keeps title sorting selected in the toolbar and task navigation", () => {
    render(<TasksWorkspace {...props} matchedCount={26} params={{ ...props.params, view: "today", sort: "title" }} />);

    const sortSelect = screen.getByRole("combobox", { name: "Sort tasks" });
    expect(sortSelect).toHaveValue("title");
    expect(within(sortSelect).getByRole("option", { name: "Title (A–Z)" })).toBeInTheDocument();
    expect(sortSelect.closest("form")).toHaveAttribute("method", "get");
    expect(sortSelect.closest("form")?.querySelector('[name="page"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Upcoming" })).toHaveAttribute("href", "/app/tasks?view=upcoming&sort=title");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/app/tasks?view=today&sort=title&page=2");
  });

  it("shows export only to permitted users and preserves the active GET filters", () => {
    const filteredParams = { ...props.params, view: "overdue" as const, q: "proposal", type: "email" as const, priority: "high" as const, sort: "title" as const, page: 4, timezoneOffset: 300, tomorrowTimezoneOffset: 240 };
    const { rerender } = render(<TasksWorkspace {...props} canExport={false} params={filteredParams} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();

    rerender(<TasksWorkspace {...props} canExport params={filteredParams} />);
    const exportButton = screen.getByRole("button", { name: "Export CSV" });
    expect(exportButton).toHaveAttribute("formAction", "/app/tasks/export");
    expect(exportButton).toHaveAttribute("formMethod", "get");
    const form = exportButton.closest("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form?.querySelector('[name="page"]')).toBeNull();
    for (const [name, value] of Object.entries({ view: "overdue", q: "proposal", type: "email", priority: "high", sort: "title", timezoneOffset: "300", tomorrowTimezoneOffset: "240" })) {
      expect(form?.querySelector(`[name="${name}"]`)).toHaveValue(value);
    }
  });

  it("links a related lead to its detail page", () => {
    const leadTask: TaskRow = {
      ...task,
      related_entity_type: "lead",
      related_entity_id: "b2a83cd5-ff2c-4da3-9b55-e4a17009ca42",
      relation: { id: "b2a83cd5-ff2c-4da3-9b55-e4a17009ca42", type: "lead", label: "Avery Chen" },
    };
    render(<TasksWorkspace {...props} tasks={[leadTask]} />);

    const row = screen.getByRole("row", { name: /Send revised proposal/ });
    expect(within(row).getByRole("link", { name: "Avery Chen" })).toHaveAttribute("href", "/app/leads/b2a83cd5-ff2c-4da3-9b55-e4a17009ca42");
  });

  it("uses a truthful fallback for an unavailable related record and hides create for viewers", () => {
    render(<TasksWorkspace {...props} canCreate={false} canEdit={false} tasks={[{ ...task, relation: null }]} />);
    const row = screen.getByRole("row", { name: /Send revised proposal/ });
    expect(within(row).getByText("Related record unavailable")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Complete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Task" })).not.toBeInTheDocument();
  });

  it("shows scoped empty-state guidance and a retry path on load failure", () => {
    render(<TasksWorkspace {...props} tasks={[]} matchedCount={0} />);
    expect(screen.getByRole("heading", { name: "No tasks to show" })).toBeInTheDocument();
    expect(screen.getByText("Tasks assigned to you will appear here.")).toBeInTheDocument();
    const reset = vi.fn();
    render(<TasksError error={new Error("load failed")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("announces task creation after closing the form", async () => {
    vi.mocked(createTaskAction).mockResolvedValueOnce({ ok: true, message: "Task created." });
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Add Task" }));
    await user.type(screen.getByRole("textbox", { name: "Task title" }), "Schedule a follow-up");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Task created."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the selected date's timezone offset when it differs from the current offset", async () => {
    vi.mocked(rescheduleTaskAction).mockResolvedValueOnce({ ok: true, message: "Task rescheduled." });
    vi.useFakeTimers({ now: new Date("2026-07-15T16:00:00.000Z"), toFake: ["Date"] });
    try {
      const user = userEvent.setup();
      render(<TasksWorkspace {...props} />);
      const row = screen.getByRole("row", { name: /Send revised proposal/ });

      await user.click(within(row).getByRole("button", { name: "Reschedule Send revised proposal" }));
      const dueDateInput = screen.getByLabelText("Due date and time");
      const originalDueAt = new Date(task.due_at!);
      const pad = (part: number) => String(part).padStart(2, "0");
      expect(dueDateInput).toHaveValue(`${originalDueAt.getFullYear()}-${pad(originalDueAt.getMonth() + 1)}-${pad(originalDueAt.getDate())}T${pad(originalDueAt.getHours())}:${pad(originalDueAt.getMinutes())}`);
      expect(dueDateInput).toHaveAttribute("type", "datetime-local");

      await user.clear(dueDateInput);
      await user.type(dueDateInput, "2026-01-15T09:45");
      await user.click(screen.getByRole("button", { name: "Save due date" }));

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Task rescheduled."));
      expect(rescheduleTaskAction).toHaveBeenCalledWith(task.id, expect.any(FormData));
      const submittedForm = vi.mocked(rescheduleTaskAction).mock.calls[0][1];
      const selectedOffset = new Date("2026-01-15T09:45").getTimezoneOffset();
      expect(submittedForm.get("dueAt")).toBe("2026-01-15T09:45");
      expect(submittedForm.get("timezoneOffset")).toBe(String(selectedOffset));
      expect(submittedForm.get("timeZone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (Intl.DateTimeFormat().resolvedOptions().timeZone === "America/New_York") {
        expect(new Date().getTimezoneOffset()).toBe(240);
        expect(selectedOffset).toBe(300);
      }
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers setting a missing due date but keeps closed tasks read-only", async () => {
    const openWithoutDate = { ...task, due_at: null };
    const completedTask = { ...task, id: "8d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", status: "completed" as const, due_at: null };
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} tasks={[openWithoutDate, completedTask]} />);

    const [openRow, closedRow] = screen.getAllByRole("row", { name: /Send revised proposal/ });
    expect(within(openRow).getByRole("button", { name: "Set due date for Send revised proposal" })).toBeInTheDocument();
    expect(within(closedRow).queryByRole("button", { name: /Reschedule|Set due date/ })).not.toBeInTheDocument();

    await user.click(within(openRow).getByRole("button", { name: "Set due date for Send revised proposal" }));
    expect(screen.getByLabelText("Due date and time")).toHaveValue("");
  });

  it.each([
    { label: "first of multiple pages", page: 1, matchedCount: 26, disabled: ["Previous"], link: { label: "Next", href: "/app/tasks?page=2" } },
    { label: "last of multiple pages", page: 2, matchedCount: 26, disabled: ["Next"], link: { label: "Previous", href: "/app/tasks" } },
    { label: "only page", page: 1, matchedCount: 1, disabled: ["Previous", "Next"], link: null },
  ])("renders actionable links only at $label", ({ page, matchedCount, disabled, link }) => {
    render(<TasksWorkspace {...props} matchedCount={matchedCount} params={{ ...props.params, page }} />);
    const pagination = screen.getByRole("navigation", { name: "Task pages" });

    for (const label of disabled) {
      const control = within(pagination).getByText(label);
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control.tagName).not.toBe("A");
    }
    if (link) expect(within(pagination).getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
  });
});
