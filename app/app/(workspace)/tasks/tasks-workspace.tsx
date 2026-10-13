"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import styles from "./tasks-workspace.module.css";
import { cancelTaskAction, completeTaskAction, createTaskAction, reopenTaskAction, rescheduleTaskAction, type TaskActionState } from "./actions";
import { taskPageSize, taskTypes, type TaskSearchParams } from "@/lib/tasks/schema";
import type { TaskOption, TaskOwner, TaskOverviewCounts, TaskRow } from "@/lib/tasks/repository";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

const blankState: TaskActionState = {};
const viewLabels = { my: "My Tasks", today: "Today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed", cancelled: "Cancelled Tasks", all: "All Tasks" } as const;
const typeLabels: Record<string, string> = { call: "Call", email: "Email", meeting: "Meeting", follow_up: "Follow-up", to_do: "To-do" };
const priorityLabels = { low: "Low", medium: "Medium", high: "High" } as const;
const relationLabels = { company: "Company", contact: "Contact", lead: "Lead", deal: "Deal" } as const;
const optionalTaskColumns = ["Type", "Related to", "Due date", "Assignee", "Priority", "Status"] as const;
type OptionalTaskColumn = (typeof optionalTaskColumns)[number];
const allTaskColumnsVisible: Record<OptionalTaskColumn, boolean> = {
  Type: true, "Related to": true, "Due date": true, Assignee: true, Priority: true, Status: true,
};

export function TasksWorkspace({ tasks, owners, options, matchedCount, overview, params, railTasks, railTaskCount, calendarMonth, calendarTaskDates, railDate, completion, canCreate, canEdit, canReassign, canExport, currentUserId }: {
  tasks: TaskRow[]; owners: TaskOwner[]; options: TaskOption[]; matchedCount: number; overview: TaskOverviewCounts; params: TaskSearchParams;
  railTasks: TaskRow[]; railTaskCount: number; calendarMonth: string; calendarTaskDates: string[]; railDate: string;
  completion: { open: number; completed: number; cancelled: number };
  canCreate: boolean; canEdit: boolean; canReassign: boolean; canExport: boolean; currentUserId: string;
}) {
  const dateFormat = useDateFormat();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<TaskRow | null>(null);
  const [visibleColumns, setVisibleColumns] = useState(allTaskColumnsVisible);
  const pageCount = Math.max(1, Math.ceil(matchedCount / taskPageSize));
  const { view, q, type, priority, sort, page, timeZone, timezoneOffset: currentTimezoneOffset, tomorrowTimezoneOffset: currentTomorrowTimezoneOffset, weekStartTimezoneOffset: currentWeekStartTimezoneOffset, nextWeekTimezoneOffset: currentNextWeekTimezoneOffset } = params;
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const daysSinceMonday = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    const nextWeek = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    const timezoneOffset = now.getTimezoneOffset();
    const tomorrowTimezoneOffset = tomorrow.getTimezoneOffset();
    const weekStartTimezoneOffset = weekStart.getTimezoneOffset();
    const nextWeekTimezoneOffset = nextWeek.getTimezoneOffset();
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (currentTimezoneOffset !== timezoneOffset || currentTomorrowTimezoneOffset !== tomorrowTimezoneOffset || currentWeekStartTimezoneOffset !== weekStartTimezoneOffset || currentNextWeekTimezoneOffset !== nextWeekTimezoneOffset || timeZone !== browserTimeZone) {
      router.replace(tasksHref({ ...params, timezoneOffset, tomorrowTimezoneOffset, weekStartTimezoneOffset, nextWeekTimezoneOffset, timeZone: browserTimeZone }));
    }
  }, [view, q, type, priority, sort, page, timeZone, params, currentTimezoneOffset, currentTomorrowTimezoneOffset, currentWeekStartTimezoneOffset, currentNextWeekTimezoneOffset, router]);

  function complete(id: string) {
    setPendingId(id); setNotice(""); setNoticeIsError(false);
    startTransition(async () => {
      let result: TaskActionState;
      try {
        result = await completeTaskAction(id);
      } catch {
        setNotice("Task could not be completed. Please try again.");
        setNoticeIsError(true);
        return;
      } finally {
        setPendingId(null);
      }
      setNotice(result.message ?? "Task could not be completed.");
      setNoticeIsError(!result.ok);
      if (result.ok) router.refresh();
    });
  }
  function changeTaskStatus(id: string, action: "cancel" | "reopen") {
    setPendingId(id); setNotice(""); setNoticeIsError(false);
    startTransition(async () => {
      let result: TaskActionState;
      try {
        result = action === "cancel" ? await cancelTaskAction(id) : await reopenTaskAction(id);
      } catch {
        setNotice(`Task could not be ${action === "cancel" ? "cancelled" : "reopened"}. Please try again.`);
        setNoticeIsError(true);
        setPendingId(null);
        return;
      }
      setPendingId(null);
      setNotice(result.message ?? `Task could not be ${action === "cancel" ? "cancelled" : "reopened"}.`);
      setNoticeIsError(!result.ok);
      if (result.ok) router.refresh();
    });
  }
  const [, startTransition] = useTransition();

  return <main className="page-container tasks-page">
    <header className="tasks-header"><div><h1 className="page-title">Tasks</h1><p className="page-description">Keep follow-ups and sales activities organized.</p></div>{canCreate && <button className="tasks-primary-button" onClick={() => setFormOpen(true)} type="button"><Plus aria-hidden="true" size={16} />Add Task</button>}</header>
    <TaskOverviewCards counts={overview} />
    <nav aria-label="Task views" className="tasks-tabs">{Object.entries(viewLabels).filter(([view]) => view !== "all" || canReassign).map(([view, label]) => <Link aria-current={params.view === view ? "page" : undefined} className={params.view === view ? "is-active" : ""} href={tasksHref({ ...params, view: view as TaskSearchParams["view"], page: 1 })} key={view}>{label}</Link>)}</nav>
    <div className={styles.layout}>
    <section aria-label="Tasks" className="tasks-panel">
      <form action="/app/tasks" className="tasks-toolbar" method="get">
        <input name="view" type="hidden" value={params.view} /><input name="timezoneOffset" type="hidden" value={params.timezoneOffset} /><input name="tomorrowTimezoneOffset" type="hidden" value={params.tomorrowTimezoneOffset} /><input name="weekStartTimezoneOffset" type="hidden" value={params.weekStartTimezoneOffset} /><input name="nextWeekTimezoneOffset" type="hidden" value={params.nextWeekTimezoneOffset} /><input name="timeZone" type="hidden" value={params.timeZone} />{params.date && <input name="date" type="hidden" value={params.date} />}{params.calendarMonth && <input name="calendarMonth" type="hidden" value={params.calendarMonth} />}
        <label className="tasks-search"><span className="sr-only">Search tasks</span><input autoComplete="off" defaultValue={params.q} maxLength={100} name="q" placeholder="Search task title or description" type="search" /></label>
        <label className="tasks-filter"><span className="sr-only">Filter by type</span><select aria-label="Filter by type" defaultValue={params.type} name="type"><option value="all">All types</option>{taskTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
        <label className="tasks-filter"><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" defaultValue={params.priority} name="priority"><option value="all">All priorities</option>{Object.entries(priorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select></label>
        <label className="tasks-filter"><span className="sr-only">Sort tasks</span><select aria-label="Sort tasks" defaultValue={params.sort} name="sort"><option value="due_date">Due date (earliest first)</option><option value="title">Title (A–Z)</option></select></label>
        <details className="tasks-column-picker"><summary>Customize columns</summary><fieldset><legend>Show columns</legend>{optionalTaskColumns.map((column) => <label key={column}><input checked={visibleColumns[column]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column]: event.target.checked }))} type="checkbox" />{column}</label>)}</fieldset></details>
        <button className="tasks-secondary-button" type="submit">Apply filters</button>
         {canExport && <button className="tasks-secondary-button" formAction="/app/tasks/export" formMethod="get" type="submit">Export CSV</button>}
      </form>
      <div className="tasks-table-wrap"><table className="tasks-table"><thead><tr>{visibleColumns.Type && <th scope="col">Type</th>}<th scope="col">Task title</th>{visibleColumns["Related to"] && <th scope="col">Related to</th>}{visibleColumns["Due date"] && <th scope="col">Due date</th>}{visibleColumns.Assignee && <th scope="col">Assignee</th>}{visibleColumns.Priority && <th scope="col">Priority</th>}{visibleColumns.Status && <th scope="col">Status</th>}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{tasks.map((task) => <tr key={task.id}>
          {visibleColumns.Type && <td data-label="Type">{typeLabels[task.task_type] ?? task.task_type}</td>}
          <th data-label="Task title" scope="row"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</th>
          {visibleColumns["Related to"] && <td data-label="Related to">{task.relation ? <Link href={relationHref(task.relation.type, task.relation.id)}>{task.relation.label}</Link> : task.related_entity_id ? <span className="tasks-muted">Related record unavailable</span> : <span className="tasks-muted">No linked record</span>}</td>}
          {visibleColumns["Due date"] && <td data-label="Due date">{task.due_at ? <time dateTime={task.due_at}>{formatDueDate(task.due_at, dateFormat)}</time> : <span className="tasks-muted">No due date</span>}{task.reminder_at && <small>Reminder: <time dateTime={task.reminder_at}>{formatDueDate(task.reminder_at, dateFormat)}</time></small>}</td>}
          {visibleColumns.Assignee && <td data-label="Assignee">{task.assigned_to ? owners.find(({ id }) => id === task.assigned_to)?.label ?? (task.assigned_to === currentUserId ? "You" : "Workspace member") : "Unassigned"}</td>}
          {visibleColumns.Priority && <td data-label="Priority"><span className={`tasks-priority priority-${task.priority}`}>{priorityLabels[task.priority]}</span></td>}
          {visibleColumns.Status && <td data-label="Status"><span className={`tasks-status status-${task.status}`}>{task.status === "completed" ? "Completed" : task.status === "cancelled" ? "Cancelled" : "Open"}</span></td>}
          <td data-label="Actions">{canEdit && task.status === "open" && <div className="tasks-row-actions"><button aria-label={task.due_at ? `Reschedule ${task.title}` : `Set due date for ${task.title}`} className="tasks-secondary-button" onClick={() => setReschedulingTask(task)} type="button">{task.due_at ? "Reschedule" : "Set due date"}</button><button aria-label={`Complete ${task.title}`} className="tasks-complete-button" disabled={pendingId === task.id} onClick={() => complete(task.id)} type="button"><Check aria-hidden="true" size={14} />{pendingId === task.id ? "Completing…" : "Complete"}</button><button aria-label={`Cancel ${task.title}`} className="tasks-secondary-button" disabled={pendingId === task.id} onClick={() => changeTaskStatus(task.id, "cancel")} type="button">{pendingId === task.id ? "Cancelling…" : "Cancel"}</button></div>}{canEdit && task.status === "cancelled" && <div className="tasks-row-actions"><button aria-label={`Reopen ${task.title}`} className="tasks-secondary-button" disabled={pendingId === task.id} onClick={() => changeTaskStatus(task.id, "reopen")} type="button">{pendingId === task.id ? "Reopening…" : "Reopen"}</button></div>}</td>
        </tr>)}</tbody></table></div>
      {tasks.length === 0 && <div className="tasks-empty"><CalendarDays aria-hidden="true" size={22} /><h2>{hasFilters(params) ? "No matching tasks" : params.view === "completed" ? "No completed tasks yet" : "No tasks to show"}</h2><p>{hasFilters(params) ? "Try changing or clearing your search and filters." : params.view === "my" ? "Tasks assigned to you will appear here." : params.view === "all" ? "Open tasks in this workspace will appear here." : `Tasks in ${viewLabels[params.view].toLowerCase()} will appear here.`}</p>{canCreate && !hasFilters(params) && params.view === "my" && <button className="tasks-secondary-button" onClick={() => setFormOpen(true)} type="button">Create your first task</button>}</div>}
      <nav aria-label="Task pages" className="tasks-pagination"><span>{matchedCount === 0 ? "0 tasks" : `${(params.page - 1) * taskPageSize + 1}–${Math.min(params.page * taskPageSize, matchedCount)} of ${matchedCount} tasks`}</span><div>{params.page <= 1 ? <span aria-disabled="true" className="is-disabled">Previous</span> : <Link href={tasksHref({ ...params, page: params.page - 1 })}>Previous</Link>}<span>Page {params.page} of {pageCount}</span>{params.page >= pageCount ? <span aria-disabled="true" className="is-disabled">Next</span> : <Link href={tasksHref({ ...params, page: params.page + 1 })}>Next</Link>}</div></nav>
    </section>
    <aside aria-label="Task calendar and summary" className={styles.rail}>
      <TaskCalendar params={params} calendarMonth={calendarMonth} calendarTaskDates={calendarTaskDates} railDate={railDate} railTaskCount={railTaskCount} railTasks={railTasks} completion={completion} />
    </aside>
    </div>
    <p aria-live={noticeIsError ? "assertive" : "polite"} className="tasks-notice" role={noticeIsError ? "alert" : "status"}>{notice}</p>
    {formOpen && <TaskForm currentUserId={currentUserId} owners={owners} options={options} canReassign={canReassign} onClose={() => setFormOpen(false)} onSaved={(message) => { setNotice(message); setNoticeIsError(false); setFormOpen(false); router.refresh(); }} />}
    {reschedulingTask && <RescheduleTaskDialog task={reschedulingTask} onClose={() => setReschedulingTask(null)} onSaved={(message) => { setNotice(message); setNoticeIsError(false); setReschedulingTask(null); router.refresh(); }} />}
  </main>;
}

function TaskOverviewCards({ counts }: { counts: TaskOverviewCounts }) {
  const cards = [
    { label: "Due Today", count: counts.dueToday },
    { label: "Overdue", count: counts.overdue },
    { label: "Completed This Week", count: counts.completedThisWeek },
    { label: "Upcoming", count: counts.upcoming },
  ];
  return <section aria-label="Task overview" className="tasks-overview">
    <h2 className="sr-only">Task overview</h2>
    <dl>{cards.map(({ label, count }) => <div className="tasks-overview-card" key={label}><dt>{label}</dt><dd>{count.toLocaleString()}</dd></div>)}</dl>
  </section>;
}

function TaskCalendar({ params, calendarMonth, calendarTaskDates, railDate, railTasks, railTaskCount, completion }: {
  params: TaskSearchParams; calendarMonth: string; calendarTaskDates: string[]; railDate: string; railTasks: TaskRow[]; railTaskCount: number;
  completion: { open: number; completed: number; cancelled: number };
}) {
  return <>
    <CalendarSection params={params} calendarMonth={calendarMonth} taskDates={calendarTaskDates} selectedDate={params.date ?? railDate} />
    <DayTaskList params={params} date={railDate} tasks={railTasks} taskCount={railTaskCount} />
    <CompletionSummary counts={completion} />
  </>;
}

function CalendarSection({ params, calendarMonth, taskDates, selectedDate }: { params: TaskSearchParams; calendarMonth: string; taskDates: string[]; selectedDate: string }) {
  const [year, month] = calendarMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = buildCalendarCells(calendarMonth, (firstDay.getUTCDay() + 6) % 7, days);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return <section aria-label="Task calendar" className={styles.section}>
    <CalendarMonthControls params={params} previousMonth={previousMonth} nextMonth={nextMonth} label={monthLabel} />
    <CalendarGrid cells={cells} month={calendarMonth} selectedDate={selectedDate.startsWith(calendarMonth) ? selectedDate : ""} taskDates={taskDates} params={params} />
    {params.date && <Link className={styles.clearDate} href={tasksHref({ ...params, date: undefined, calendarMonth, page: 1 })}>Clear day filter</Link>}
  </section>;
}

function CalendarMonthControls({ params, previousMonth, nextMonth, label }: { params: TaskSearchParams; previousMonth: string; nextMonth: string; label: string }) {
  return <header className={styles.sectionHeader}><h2>Calendar</h2><nav aria-label="Calendar month navigation" className={styles.monthNavigation}>
    <Link aria-label="Previous month" href={tasksHref({ ...params, calendarMonth: previousMonth, page: 1 })}><ChevronLeft aria-hidden="true" size={15} /></Link>
    <strong aria-live="polite">{label}</strong>
    <Link aria-label="Next month" href={tasksHref({ ...params, calendarMonth: nextMonth, page: 1 })}><ChevronRight aria-hidden="true" size={15} /></Link>
  </nav></header>;
}

function CalendarGrid({ cells, month, selectedDate, taskDates, params }: { cells: Array<string | null>; month: string; selectedDate: string; taskDates: string[]; params: TaskSearchParams }) {
  return <div className={styles.calendar}>
    {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => <span className={styles.weekday} key={day}>{day}</span>)}
    {cells.map((date, index) => date ? <CalendarDay key={date} date={date} selected={date === selectedDate} hasTasks={taskDates.includes(date)} params={params} calendarMonth={month} /> : <span aria-hidden="true" className={styles.daySpacer} key={`spacer-${index}`} />)}
  </div>;
}

function buildCalendarCells(month: string, leadingDays: number, dayCount: number) {
  return Array.from({ length: leadingDays + dayCount }, (_, index) => index < leadingDays ? null : `${month}-${String(index - leadingDays + 1).padStart(2, "0")}`);
}

function CalendarDay({ date, selected, hasTasks, params, calendarMonth }: { date: string; selected: boolean; hasTasks: boolean; params: TaskSearchParams; calendarMonth: string }) {
  const accessibleDate = new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return <Link aria-current={selected ? "date" : undefined} aria-label={`${accessibleDate}${hasTasks ? ", tasks due" : ""}`} className={`${styles.day} ${selected ? styles.selected : ""}`} href={tasksHref({ ...params, date, calendarMonth, page: 1 })}>
    {Number(date.slice(-2))}{hasTasks && <span aria-hidden="true" className={styles.dayMarker} />}
  </Link>;
}

function DayTaskList({ params, date, tasks, taskCount }: { params: TaskSearchParams; date: string; tasks: TaskRow[]; taskCount: number }) {
  const dateFormat = useDateFormat();
  const label = new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return <section aria-labelledby="tasks-rail-title" className={styles.section}>
    <header className={styles.sectionHeader}><h2 id="tasks-rail-title">{params.date ? `Tasks · ${label}` : "Today's Tasks"}</h2><span className={styles.count}>{taskCount}</span></header>
    {tasks.length ? <ul className={styles.taskList}>{tasks.map((task) => <li key={task.id}>
      <span aria-hidden="true" className={`${styles.taskMarker} ${task.status === "completed" ? styles.completed : task.status === "cancelled" ? styles.cancelled : ""}`} />
      <div><strong>{task.title}</strong><span>{task.due_at ? formatDueDate(task.due_at, dateFormat) : "No due time"}</span></div>
      <span className={styles.taskStatus}>{task.status === "completed" ? "Completed" : task.status === "cancelled" ? "Cancelled" : "Open"}</span>
    </li>)}</ul> : <p className={styles.empty}>{taskCount === 0 ? `No tasks due ${params.date ? "on this day" : "today"}.` : "No tasks match the current filters."}</p>}
    {taskCount > tasks.length && <p className={styles.moreTasks}>Showing {tasks.length} of {taskCount} tasks</p>}
  </section>;
}

function CompletionSummary({ counts }: { counts: { open: number; completed: number; cancelled: number } }) {
  const total = counts.open + counts.completed + counts.cancelled;
  const percentage = total === 0 ? 0 : Math.round((counts.completed / total) * 100);
  return <section aria-labelledby="task-completion-title" className={styles.section}>
    <header className={styles.sectionHeader}><h2 id="task-completion-title">Task completion</h2></header>
    {total === 0 ? <p className={styles.empty}>No task records yet.</p> : <>
      <div className={styles.completionText}><strong>{counts.completed.toLocaleString()} completed</strong><span>{percentage}% of {total.toLocaleString()} total tasks</span></div>
      <progress aria-label="Task completion" className={styles.progress} max={total} value={counts.completed}>{percentage}%</progress>
      <dl className={styles.statusCounts}><div><dt>Open</dt><dd>{counts.open.toLocaleString()}</dd></div><div><dt>Cancelled</dt><dd>{counts.cancelled.toLocaleString()}</dd></div></dl>
    </>}
  </section>;
}

function TaskForm({ options, owners, canReassign, currentUserId, onClose, onSaved }: { options: TaskOption[]; owners: TaskOwner[]; canReassign: boolean; currentUserId: string; onClose: () => void; onSaved: (message: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<TaskActionState>(blankState);
  const [pending, startTransition] = useTransition();
  const [relatedType, setRelatedType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  function submit(formData: FormData) {
    formData.set("relatedType", relatedType);
    formData.set("relatedId", relatedId);
    const dueAt = formData.get("dueAt");
    const offset = formData.get("timezoneOffset");
    if (typeof dueAt === "string" && dueAt && typeof offset === "string") formData.set("timezoneOffset", offset);
    const reminderAt = formData.get("reminderAt");
    if (typeof reminderAt === "string" && reminderAt) {
      const reminderDate = new Date(reminderAt);
      if (Number.isNaN(reminderDate.getTime()) || localDateTimeValue(reminderDate) !== reminderAt) {
        setResult({ message: "Choose a valid local reminder time.", fieldErrors: { reminderAt: ["This time does not exist because the clocks change. Choose another time."] } });
        return;
      }
      formData.set("reminderTimezoneOffset", String(reminderDate.getTimezoneOffset()));
    }
    setResult(blankState);
    startTransition(async () => {
      const next = await createTaskAction(blankState, formData);
      setResult(next);
      if (next.ok) onSaved(next.message ?? "Task created.");
    });
  }
  const relatedOptions = options.filter((option) => option.type === relatedType);
  const errors = result.fieldErrors ?? {};
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (dialog.open) { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); } };
  }, []);
  return <dialog aria-labelledby="task-form-title" aria-modal="true" className="tasks-dialog" onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} ref={dialogRef}>
    <div className="tasks-dialog-content"><header className="tasks-dialog-header"><div><h2 id="task-form-title">Add task</h2><p>Create a follow-up in this workspace.</p></div><button aria-label="Close task form" className="tasks-close-button" disabled={pending} onClick={onClose} type="button">×</button></header>
      <form action={submit} className="tasks-form">
        <label className="tasks-field">Task title<input autoFocus maxLength={200} name="title" required />{errors.title?.[0] && <small>{errors.title[0]}</small>}</label>
        <div className="tasks-form-grid"><label className="tasks-field">Type<select defaultValue="to_do" name="type">{taskTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label><label className="tasks-field">Priority<select defaultValue="medium" name="priority">{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <label className="tasks-field">Due date<input name="dueAt" type="datetime-local" /><input name="timezoneOffset" type="hidden" value={String(new Date().getTimezoneOffset())} />{errors.dueAt?.[0] && <small>{errors.dueAt[0]}</small>}</label>
         <label className="tasks-field">Reminder (optional)<input aria-describedby={errors.reminderAt ? "task-reminder-error" : undefined} aria-invalid={Boolean(errors.reminderAt)} name="reminderAt" type="datetime-local" />{errors.reminderAt?.[0] && <small id="task-reminder-error">{errors.reminderAt[0]}</small>}<input name="reminderTimezoneOffset" type="hidden" value={String(new Date().getTimezoneOffset())} /></label>
        <label className="tasks-field">Description<textarea maxLength={5000} name="description" rows={3} /></label>
        <div className="tasks-form-grid"><label className="tasks-field">Related record type<select onChange={(event) => { setRelatedType(event.target.value); setRelatedId(""); }} value={relatedType}><option value="">No related record</option>{Object.entries(relationLabels).filter(([type]) => options.some((option) => option.type === type)).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="tasks-field">Related record<select disabled={!relatedType} onChange={(event) => setRelatedId(event.target.value)} value={relatedId}><option value="">{relatedType ? "Choose a record" : "No related record"}</option>{relatedOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>{errors.relatedId?.[0] && <small>{errors.relatedId[0]}</small>}</label></div>
        {canReassign ? <label className="tasks-field">Assign to<select defaultValue={currentUserId} name="assignedTo"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select>{errors.assignedTo?.[0] && <small>{errors.assignedTo[0]}</small>}</label> : <input name="assignedTo" type="hidden" value={currentUserId} />}
        {result.message && <p className={result.ok ? "tasks-form-success" : "tasks-form-error"} role={result.ok ? "status" : "alert"}>{result.message}</p>}
        <footer className="tasks-form-actions"><button className="tasks-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="tasks-primary-button" disabled={pending} type="submit">{pending ? "Creating…" : "Create task"}</button></footer>
      </form>
    </div>
  </dialog>;
}

function RescheduleTaskDialog({ task, onClose, onSaved }: { task: TaskRow; onClose: () => void; onSaved: (message: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<TaskActionState>(blankState);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    const dueAt = form.get("dueAt");
    const selectedDate = typeof dueAt === "string" ? new Date(dueAt) : new Date(Number.NaN);
    if (Number.isNaN(selectedDate.getTime()) || localDateTimeValue(selectedDate) !== dueAt) {
      setResult({ message: "Choose another local due date and time.", fieldErrors: { dueAt: ["This time does not exist because the clocks change. Choose another time."] } });
      return;
    }
    form.set("timezoneOffset", String(selectedDate.getTimezoneOffset()));
    form.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    setResult(blankState);
    startTransition(async () => {
      const next = await rescheduleTaskAction(task.id, form);
      setResult(next);
      if (next.ok) onSaved(next.message ?? "Task rescheduled.");
    });
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (dialog.open) { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); } };
  }, []);

  const dueAtError = result.fieldErrors?.dueAt?.[0] ?? result.fieldErrors?.timezoneOffset?.[0];
  return <dialog aria-labelledby="reschedule-task-title" aria-modal="true" className="tasks-dialog" onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} ref={dialogRef}>
    <div className="tasks-dialog-content"><header className="tasks-dialog-header"><div><h2 id="reschedule-task-title">{task.due_at ? "Reschedule task" : "Set task due date"}</h2><p>{task.title}</p></div><button aria-label="Close reschedule dialog" className="tasks-close-button" disabled={pending} onClick={onClose} type="button">×</button></header>
      <form action={submit} className="tasks-form">
        <label className="tasks-field">Due date and time<input aria-describedby={dueAtError ? "reschedule-date-error" : undefined} aria-invalid={Boolean(dueAtError)} autoFocus defaultValue={task.due_at ? localDateTimeValue(task.due_at) : ""} name="dueAt" required type="datetime-local" />{dueAtError && <small id="reschedule-date-error">{dueAtError}</small>}</label>
        {result.message && !result.ok && <p className="tasks-form-error" role="alert">{result.message}</p>}
        <footer className="tasks-form-actions"><button className="tasks-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="tasks-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save due date"}</button></footer>
      </form>
    </div>
  </dialog>;
}

function localDateTimeValue(dateTime: string | Date) {
  const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDueDate(value: string, dateFormat: DateFormat) { return formatCalendarDateTime(value, dateFormat); }
function relationHref(type: TaskRow["related_entity_type"] & string, id: string) {
  if (type === "lead") return `/app/leads/${id}`;
  const section = type === "company" ? "companies" : type === "contact" ? "contacts" : "deals";
  return `/app/${section}/${id}`;
}
function hasFilters(params: TaskSearchParams) { return Boolean(params.q || params.priority !== "all" || params.type !== "all" || params.date); }
function tasksHref(params: TaskSearchParams) { const query = new URLSearchParams(); if (params.view !== "my") query.set("view", params.view); if (params.q) query.set("q", params.q); if (params.type !== "all") query.set("type", params.type); if (params.priority !== "all") query.set("priority", params.priority); if (params.sort !== "due_date") query.set("sort", params.sort); if (params.timezoneOffset !== 0 || params.tomorrowTimezoneOffset !== 0 || params.weekStartTimezoneOffset !== 0 || params.nextWeekTimezoneOffset !== 0) { query.set("timezoneOffset", String(params.timezoneOffset)); query.set("tomorrowTimezoneOffset", String(params.tomorrowTimezoneOffset)); query.set("weekStartTimezoneOffset", String(params.weekStartTimezoneOffset)); query.set("nextWeekTimezoneOffset", String(params.nextWeekTimezoneOffset)); } if (params.timeZone !== "UTC") query.set("timeZone", params.timeZone); if (params.date) query.set("date", params.date); if (params.calendarMonth) query.set("calendarMonth", params.calendarMonth); if (params.page > 1) query.set("page", String(params.page)); const value = query.toString(); return `/app/tasks${value ? `?${value}` : ""}`; }
