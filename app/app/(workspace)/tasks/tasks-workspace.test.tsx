import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { cancelTaskAction, completeTaskAction, createTaskAction, reopenTaskAction, rescheduleTaskAction, updateTaskAction } from "./actions";
import { TasksWorkspace } from "./tasks-workspace";
import TasksError from "./error";
import type { TaskRow } from "@/lib/tasks/repository";
import type { TaskSearchParams } from "@/lib/tasks/schema";

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: routerRefresh, replace: vi.fn() }) }));
vi.mock("./actions", () => ({ cancelTaskAction: vi.fn(), completeTaskAction: vi.fn(), createTaskAction: vi.fn(), reopenTaskAction: vi.fn(), rescheduleTaskAction: vi.fn(), updateTaskAction: vi.fn() }));

const task: TaskRow = {
  id: "c2155412-d8a0-4792-b2bc-f6064b2798f4", title: "Send revised proposal", description: "Include the support scope.", task_type: "email",
  status: "open", priority: "high", due_at: "2026-04-05T14:30:00.000Z", reminder_at: "2026-04-05T13:30:00.000Z", assigned_to: "c2155412-d8a0-4792-b2bc-f6064b2798f4",
  created_by: "c2155412-d8a0-4792-b2bc-f6064b2798f4", related_entity_type: "company", related_entity_id: "012be84b-6794-4e6a-a149-8d92c0a4d110",
  completed_at: null, relation: { id: "012be84b-6794-4e6a-a149-8d92c0a4d110", type: "company", label: "Northstar Labs" },
};
const props = { tasks: [task], owners: [{ id: task.assigned_to!, label: "You" }], options: [], matchedCount: 1, overview: { dueToday: 3, overdue: 2, completedThisWeek: 7, upcoming: 11 }, params: { view: "my", q: "", type: "all", priority: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, timeZone: "UTC", page: 1 } as TaskSearchParams, railTasks: [task], railTaskCount: 1, calendarMonth: "2026-04", calendarTaskDates: ["2026-04-05"], railDate: "2026-04-05", completion: { open: 4, completed: 7, cancelled: 1 }, canCreate: true, createIntent: false, createContext: null, canEdit: true, canReassign: false, canExport: true, currentUserId: task.assigned_to! };

function expectTaskTableColumnsAligned() {
  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent?.trim());
  const row = within(table).getAllByRole("row")[1];
  const cellLabels = Array.from(row.querySelectorAll("th, td")).map((cell) => cell.getAttribute("data-label"));
  expect(cellLabels).toEqual(headers);
}

describe("TasksWorkspace", () => {
  it("opens a permitted create intent with the server-approved related record selected", () => {
    const options = [{ id: "83d8aaf1-c78e-41db-ae18-493f44c84b42", type: "lead" as const, label: "Mira Chen" }];
    const { rerender } = render(<TasksWorkspace {...props} options={options} createIntent createContext={{ type: "lead", id: options[0].id }} />);
    expect(screen.getByRole("dialog", { name: "Add task" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Related record type" })).toHaveValue("lead");
    expect(screen.getByRole("combobox", { name: "Related record" })).toHaveValue(options[0].id);
    rerender(<TasksWorkspace {...props} options={options} canCreate={false} createIntent createContext={{ type: "lead", id: options[0].id }} />);
    expect(screen.queryByRole("dialog", { name: "Add task" })).not.toBeInTheDocument();
  });

  it("renders the four workspace task overview counts", () => {
    render(<TasksWorkspace {...props} />);
    const overview = screen.getByRole("region", { name: "Task overview" });

    expect(within(overview).getByText("Due Today")).toBeInTheDocument();
    expect(within(overview).getByText("3")).toBeInTheDocument();
    expect(within(overview).getByText("Overdue")).toBeInTheDocument();
    expect(within(overview).getByText("2")).toBeInTheDocument();
    expect(within(overview).getByText("Completed This Week")).toBeInTheDocument();
    expect(within(overview).getByText("7")).toBeInTheDocument();
    expect(within(overview).getByText("Upcoming")).toBeInTheDocument();
    expect(within(overview).getByText("11")).toBeInTheDocument();
  });

  it("renders the persisted day task list and honest status-count completion summary", () => {
    render(<TasksWorkspace {...props} />);
    expect(screen.getByRole("heading", { name: "Today's Tasks" })).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("Send revised proposal")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Task completion" })).toHaveAttribute("value", "7");
    expect(screen.getByText("7 completed")).toBeInTheDocument();
    expect(screen.getByText("58% of 12 total tasks")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("selects a calendar day and navigates months without dropping active filters", () => {
    const params = { ...props.params, q: "proposal", type: "email" as const, priority: "high" as const, sort: "title" as const };
    const { rerender } = render(<TasksWorkspace {...props} params={params} />);
    expect(screen.getByRole("link", { name: /April 5, 2026, tasks due/ })).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("link", { name: /April 6, 2026/ })).toHaveAttribute("href", "/app/tasks?q=proposal&type=email&priority=high&sort=title&date=2026-04-06&calendarMonth=2026-04");
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute("href", "/app/tasks?q=proposal&type=email&priority=high&sort=title&calendarMonth=2026-03");

    rerender(<TasksWorkspace {...props} params={{ ...params, date: "2026-04-06", calendarMonth: "2026-04" }} railDate="2026-04-06" />);
    expect(screen.getByRole("heading", { name: "Tasks · April 6, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear day filter" })).toHaveAttribute("href", "/app/tasks?q=proposal&type=email&priority=high&sort=title&calendarMonth=2026-04");
  });

  it("renders explicit empty states when there are no day tasks or persisted summary records", () => {
    render(<TasksWorkspace {...props} railTasks={[]} railTaskCount={0} completion={{ open: 0, completed: 0, cancelled: 0 }} />);
    expect(screen.getByText("No tasks due today.")).toBeInTheDocument();
    expect(screen.getByText("No task records yet.")).toBeInTheDocument();
  });

  it("renders persisted task fields, valid relation link, filters, and quick-completion action", () => {
    render(<TasksWorkspace {...props} />);
    const row = screen.getByRole("row", { name: /Email Send revised proposal/ });
    expect(within(row).getByText("Include the support scope.")).toBeInTheDocument();
    expect(within(row).getByText(/Reminder:/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Northstar Labs" })).toHaveAttribute("href", "/app/companies/012be84b-6794-4e6a-a149-8d92c0a4d110");
    expect(within(row).getByText("You")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Complete Send revised proposal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("combobox", { name: "Filter by priority" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort tasks" })).toHaveValue("due_date");
  });

  it("shows optional columns by default and aligns each header with its responsive cell label", async () => {
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);
    await user.click(screen.getByText("Customize columns"));
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];

    for (const column of ["Type", "Related to", "Due date", "Assignee", "Priority", "Status"]) {
      expect(screen.getByRole("checkbox", { name: column })).toBeChecked();
      expect(within(table).getByRole("columnheader", { name: column })).toBeInTheDocument();
      expect(row.querySelector(`[data-label="${column}"]`)).toBeInTheDocument();
    }
    expectTaskTableColumnsAligned();
  });

  it("lets permitted editors cancel an open task and announces a successful refresh", async () => {
    vi.clearAllMocks();
    vi.mocked(cancelTaskAction).mockResolvedValueOnce({ ok: true, message: "Task cancelled." });
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Cancel Send revised proposal" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Task cancelled.");
    expect(cancelTaskAction).toHaveBeenCalledWith(task.id);
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("announces cancellation failures and restores the control", async () => {
    vi.clearAllMocks();
    vi.mocked(cancelTaskAction).mockRejectedValueOnce(new Error("Request failed"));
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);
    const cancelButton = screen.getByRole("button", { name: "Cancel Send revised proposal" });

    await user.click(cancelButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be cancelled. Please try again.");
    await waitFor(() => expect(cancelButton).toBeEnabled());
  });

  it("offers reopen only for cancelled tasks and hides lifecycle controls from viewers and completed tasks", async () => {
    vi.clearAllMocks();
    vi.mocked(reopenTaskAction).mockResolvedValueOnce({ ok: true, message: "Task reopened." });
    const user = userEvent.setup();
    const cancelledTask = { ...task, status: "cancelled" as const };
    const { rerender } = render(<TasksWorkspace {...props} params={{ ...props.params, view: "cancelled" }} tasks={[cancelledTask]} />);

    expect(screen.getByRole("link", { name: "Cancelled Tasks" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Reopen Send revised proposal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Task reopened.");
    expect(reopenTaskAction).toHaveBeenCalledWith(task.id);
    expect(routerRefresh).toHaveBeenCalled();

    rerender(<TasksWorkspace {...props} canEdit={false} tasks={[task]} />);
    expect(screen.queryByRole("button", { name: "Cancel Send revised proposal" })).not.toBeInTheDocument();
    rerender(<TasksWorkspace {...props} tasks={[{ ...task, status: "completed" }]} />);
    expect(screen.queryByRole("button", { name: /Cancel|Reopen/ })).not.toBeInTheDocument();
  });

  it("hides and restores an optional column without hiding task title or actions", async () => {
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);

    await user.click(screen.getByText("Customize columns"));
    const typeColumn = screen.getByRole("checkbox", { name: "Type" });
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];

    await user.click(typeColumn);
    expect(within(table).queryByRole("columnheader", { name: "Type" })).not.toBeInTheDocument();
    expect(row.querySelector('[data-label="Type"]')).toBeNull();
    expect(within(table).getByRole("columnheader", { name: "Task title" })).toBeInTheDocument();
    expect(within(row).getByRole("rowheader", { name: /Send revised proposal/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(row.querySelector('[data-label="Actions"]')).toBeInTheDocument();
    expectTaskTableColumnsAligned();

    await user.click(typeColumn);
    expect(within(table).getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(row.querySelector('[data-label="Type"]')).toHaveTextContent("Email");
    expectTaskTableColumnsAligned();
  });

  it("announces a resolved unsuccessful completion result as an alert", async () => {
    vi.mocked(completeTaskAction).mockResolvedValueOnce({ message: "Task could not be completed. Refresh and try again." });
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Complete Send revised proposal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be completed. Refresh and try again.");
  });

  it("shows a failure alert and re-enables completion after the action rejects", async () => {
    vi.mocked(completeTaskAction).mockRejectedValueOnce(new Error("Request failed"));
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);
    const completeButton = screen.getByRole("button", { name: "Complete Send revised proposal" });

    await user.click(completeButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be completed. Please try again.");
    await waitFor(() => expect(completeButton).toBeEnabled());
  });

  it("shows All Tasks only with permission and preserves selection and navigation state", () => {
    const params = { ...props.params, view: "all" as const, q: "proposal", type: "email" as const, priority: "high" as const, sort: "title" as const, page: 2 };
    const { rerender } = render(<TasksWorkspace {...props} canReassign={false} params={params} tasks={[]} matchedCount={0} />);
    expect(screen.queryByRole("link", { name: "All Tasks" })).not.toBeInTheDocument();

    rerender(<TasksWorkspace {...props} canReassign params={params} tasks={[]} matchedCount={0} />);
    const allTasks = screen.getByRole("link", { name: "All Tasks" });
    expect(allTasks).toHaveAttribute("aria-current", "page");
    expect(allTasks).toHaveAttribute("href", "/app/tasks?view=all&q=proposal&type=email&priority=high&sort=title");
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("href", "/app/tasks?q=proposal&type=email&priority=high&sort=title");

    rerender(<TasksWorkspace {...props} canReassign params={{ ...props.params, view: "all" }} tasks={[]} matchedCount={0} />);
    expect(screen.getByText("Open tasks in this workspace will appear here.")).toBeInTheDocument();
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
    const filteredParams = { ...props.params, view: "overdue" as const, q: "proposal", type: "email" as const, priority: "high" as const, sort: "title" as const, page: 4, timezoneOffset: 300, tomorrowTimezoneOffset: 240, weekStartTimezoneOffset: 300, nextWeekTimezoneOffset: 240 };
    const { rerender } = render(<TasksWorkspace {...props} canExport={false} params={filteredParams} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();

    rerender(<TasksWorkspace {...props} canExport params={filteredParams} />);
    const exportButton = screen.getByRole("button", { name: "Export CSV" });
    expect(exportButton).toHaveAttribute("formAction", "/app/tasks/export");
    expect(exportButton).toHaveAttribute("formMethod", "get");
    const form = exportButton.closest("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form?.querySelector('[name="page"]')).toBeNull();
    for (const [name, value] of Object.entries({ view: "overdue", q: "proposal", type: "email", priority: "high", sort: "title", timezoneOffset: "300", tomorrowTimezoneOffset: "240", weekStartTimezoneOffset: "300", nextWeekTimezoneOffset: "240" })) {
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

  it("submits the optional reminder as a local datetime with its browser offset", async () => {
    vi.mocked(createTaskAction).mockResolvedValueOnce({ ok: true, message: "Task created." });
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Add Task" }));
    await user.type(screen.getByRole("textbox", { name: "Task title" }), "Send the reminder");
    const reminderInput = screen.getByLabelText("Reminder (optional)");
    (reminderInput as HTMLInputElement).value = "2026-04-03T10:30";
    fireEvent.input(reminderInput);
    expect(reminderInput).toHaveValue("2026-04-03T10:30");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Task created.")).toBeInTheDocument();
    const submittedForm = vi.mocked(createTaskAction).mock.calls.at(-1)![1];
    expect(submittedForm.get("reminderAt")).toBe("2026-04-03T10:30");
    expect(submittedForm.get("reminderTimezoneOffset")).toBe(String(new Date("2026-04-03T10:30").getTimezoneOffset()));
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

  it("shows a Tomorrow tab alongside the other task views", () => {
    render(<TasksWorkspace {...props} />);
    const tomorrow = screen.getByRole("link", { name: "Tomorrow" });
    expect(tomorrow).toHaveAttribute("href", "/app/tasks?view=tomorrow");

    render(<TasksWorkspace {...props} params={{ ...props.params, view: "tomorrow" }} />);
    expect(screen.getAllByRole("link", { name: "Tomorrow" }).at(-1)).toHaveAttribute("aria-current", "page");
  });

  it("opens the edit dialog prefilled with the task's current details and saves changes", async () => {
    vi.mocked(updateTaskAction).mockResolvedValueOnce({ ok: true, message: "Task updated." });
    const user = userEvent.setup();
    render(<TasksWorkspace {...props} />);
    const row = screen.getByRole("row", { name: /Send revised proposal/ });

    await user.click(within(row).getByRole("button", { name: "Edit Send revised proposal" }));

    expect(screen.getByRole("dialog", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveValue("Send revised proposal");
    expect(screen.getByLabelText("Description")).toHaveValue("Include the support scope.");

    await user.clear(screen.getByRole("textbox", { name: "Task title" }));
    await user.type(screen.getByRole("textbox", { name: "Task title" }), "Send the final proposal");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Task updated.")).toBeInTheDocument();
    expect(updateTaskAction).toHaveBeenCalledWith(task.id, {}, expect.any(FormData));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("shows an edit error without closing the dialog and hides edit for completed tasks or non-editors", async () => {
    vi.mocked(updateTaskAction).mockResolvedValueOnce({ message: "Task could not be updated. Refresh and try again." });
    const user = userEvent.setup();
    const { rerender } = render(<TasksWorkspace {...props} />);
    const row = screen.getByRole("row", { name: /Send revised proposal/ });

    await user.click(within(row).getByRole("button", { name: "Edit Send revised proposal" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be updated. Refresh and try again.");
    expect(screen.getByRole("dialog", { name: "Edit task" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close edit task form" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<TasksWorkspace {...props} tasks={[{ ...task, status: "completed" }]} />);
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();

    rerender(<TasksWorkspace {...props} canEdit={false} tasks={[task]} />);
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
