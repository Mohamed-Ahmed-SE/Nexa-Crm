"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, Plus } from "lucide-react";
import { completeTaskAction, createTaskAction, rescheduleTaskAction, type TaskActionState } from "./actions";
import { taskPageSize, taskTypes, type TaskSearchParams } from "@/lib/tasks/schema";
import type { TaskOption, TaskOwner, TaskRow } from "@/lib/tasks/repository";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

const blankState: TaskActionState = {};
const viewLabels = { my: "My Tasks", today: "Today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed" } as const;
const typeLabels: Record<string, string> = { call: "Call", email: "Email", meeting: "Meeting", follow_up: "Follow-up", to_do: "To-do" };
const priorityLabels = { low: "Low", medium: "Medium", high: "High" } as const;
const relationLabels = { company: "Company", contact: "Contact", lead: "Lead", deal: "Deal" } as const;

export function TasksWorkspace({ tasks, owners, options, matchedCount, params, canCreate, canEdit, canReassign, canExport, currentUserId }: {
  tasks: TaskRow[]; owners: TaskOwner[]; options: TaskOption[]; matchedCount: number; params: TaskSearchParams;
  canCreate: boolean; canEdit: boolean; canReassign: boolean; canExport: boolean; currentUserId: string;
}) {
  const dateFormat = useDateFormat();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<TaskRow | null>(null);
  const pageCount = Math.max(1, Math.ceil(matchedCount / taskPageSize));
  const { view, q, type, priority, sort, page, timezoneOffset: currentTimezoneOffset, tomorrowTimezoneOffset: currentTomorrowTimezoneOffset } = params;
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timezoneOffset = now.getTimezoneOffset();
    const tomorrowTimezoneOffset = tomorrow.getTimezoneOffset();
    if (currentTimezoneOffset !== timezoneOffset || currentTomorrowTimezoneOffset !== tomorrowTimezoneOffset) {
      router.replace(tasksHref({ view, q, type, priority, sort, page, timezoneOffset, tomorrowTimezoneOffset }));
    }
  }, [view, q, type, priority, sort, page, currentTimezoneOffset, currentTomorrowTimezoneOffset, router]);

  function complete(id: string) {
    setPendingId(id); setNotice("");
    startTransition(async () => {
      const result = await completeTaskAction(id);
      setNotice(result.message ?? "Task could not be completed.");
      setPendingId(null);
      if (result.ok) router.refresh();
    });
  }
  const [, startTransition] = useTransition();

  return <main className="page-container tasks-page">
    <header className="tasks-header"><div><h1 className="page-title">Tasks</h1><p className="page-description">Keep follow-ups and sales activities organized.</p></div>{canCreate && <button className="tasks-primary-button" onClick={() => setFormOpen(true)} type="button"><Plus aria-hidden="true" size={16} />Add Task</button>}</header>
    <nav aria-label="Task views" className="tasks-tabs">{Object.entries(viewLabels).map(([view, label]) => <Link aria-current={params.view === view ? "page" : undefined} className={params.view === view ? "is-active" : ""} href={tasksHref({ ...params, view: view as TaskSearchParams["view"], page: 1 })} key={view}>{label}</Link>)}</nav>
    <section aria-label="Tasks" className="tasks-panel">
      <form action="/app/tasks" className="tasks-toolbar" method="get">
        <input name="view" type="hidden" value={params.view} /><input name="timezoneOffset" type="hidden" value={params.timezoneOffset} /><input name="tomorrowTimezoneOffset" type="hidden" value={params.tomorrowTimezoneOffset} />
        <label className="tasks-search"><span className="sr-only">Search tasks</span><input autoComplete="off" defaultValue={params.q} maxLength={100} name="q" placeholder="Search task title or description" type="search" /></label>
        <label className="tasks-filter"><span className="sr-only">Filter by type</span><select aria-label="Filter by type" defaultValue={params.type} name="type"><option value="all">All types</option>{taskTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
        <label className="tasks-filter"><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" defaultValue={params.priority} name="priority"><option value="all">All priorities</option>{Object.entries(priorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select></label>
        <label className="tasks-filter"><span className="sr-only">Sort tasks</span><select aria-label="Sort tasks" defaultValue={params.sort} name="sort"><option value="due_date">Due date (earliest first)</option><option value="title">Title (A–Z)</option></select></label>
        <button className="tasks-secondary-button" type="submit">Apply filters</button>
         {canExport && <button className="tasks-secondary-button" formAction="/app/tasks/export" formMethod="get" type="submit">Export CSV</button>}
      </form>
      <div className="tasks-table-wrap"><table className="tasks-table"><thead><tr><th scope="col">Type</th><th scope="col">Task title</th><th scope="col">Related to</th><th scope="col">Due date</th><th scope="col">Assignee</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{tasks.map((task) => <tr key={task.id}>
          <td data-label="Type">{typeLabels[task.task_type] ?? task.task_type}</td>
          <th data-label="Task title" scope="row"><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</th>
          <td data-label="Related to">{task.relation ? <Link href={relationHref(task.relation.type, task.relation.id)}>{task.relation.label}</Link> : task.related_entity_id ? <span className="tasks-muted">Related record unavailable</span> : <span className="tasks-muted">No linked record</span>}</td>
          <td data-label="Due date">{task.due_at ? <time dateTime={task.due_at}>{formatDueDate(task.due_at, dateFormat)}</time> : <span className="tasks-muted">No due date</span>}</td>
          <td data-label="Assignee">{task.assigned_to ? owners.find(({ id }) => id === task.assigned_to)?.label ?? (task.assigned_to === currentUserId ? "You" : "Workspace member") : "Unassigned"}</td>
          <td data-label="Priority"><span className={`tasks-priority priority-${task.priority}`}>{priorityLabels[task.priority]}</span></td>
          <td data-label="Status"><span className={`tasks-status status-${task.status}`}>{task.status === "completed" ? "Completed" : task.status === "cancelled" ? "Cancelled" : "Open"}</span></td>
          <td data-label="Actions">{canEdit && task.status === "open" && <div className="tasks-row-actions"><button aria-label={task.due_at ? `Reschedule ${task.title}` : `Set due date for ${task.title}`} className="tasks-secondary-button" onClick={() => setReschedulingTask(task)} type="button">{task.due_at ? "Reschedule" : "Set due date"}</button><button aria-label={`Complete ${task.title}`} className="tasks-complete-button" disabled={pendingId === task.id} onClick={() => complete(task.id)} type="button"><Check aria-hidden="true" size={14} />{pendingId === task.id ? "Completing…" : "Complete"}</button></div>}</td>
        </tr>)}</tbody></table></div>
      {tasks.length === 0 && <div className="tasks-empty"><CalendarDays aria-hidden="true" size={22} /><h2>{hasFilters(params) ? "No matching tasks" : params.view === "completed" ? "No completed tasks yet" : "No tasks to show"}</h2><p>{hasFilters(params) ? "Try changing or clearing your search and filters." : params.view === "my" ? "Tasks assigned to you will appear here." : `Tasks in ${viewLabels[params.view].toLowerCase()} will appear here.`}</p>{canCreate && !hasFilters(params) && params.view === "my" && <button className="tasks-secondary-button" onClick={() => setFormOpen(true)} type="button">Create your first task</button>}</div>}
      <nav aria-label="Task pages" className="tasks-pagination"><span>{matchedCount === 0 ? "0 tasks" : `${(params.page - 1) * taskPageSize + 1}–${Math.min(params.page * taskPageSize, matchedCount)} of ${matchedCount} tasks`}</span><div>{params.page <= 1 ? <span aria-disabled="true" className="is-disabled">Previous</span> : <Link href={tasksHref({ ...params, page: params.page - 1 })}>Previous</Link>}<span>Page {params.page} of {pageCount}</span>{params.page >= pageCount ? <span aria-disabled="true" className="is-disabled">Next</span> : <Link href={tasksHref({ ...params, page: params.page + 1 })}>Next</Link>}</div></nav>
    </section>
    <p aria-live="polite" className="tasks-notice" role="status">{notice}</p>
    {formOpen && <TaskForm currentUserId={currentUserId} owners={owners} options={options} canReassign={canReassign} onClose={() => setFormOpen(false)} onSaved={(message) => { setNotice(message); setFormOpen(false); router.refresh(); }} />}
    {reschedulingTask && <RescheduleTaskDialog task={reschedulingTask} onClose={() => setReschedulingTask(null)} onSaved={(message) => { setNotice(message); setReschedulingTask(null); router.refresh(); }} />}
  </main>;
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
function hasFilters(params: TaskSearchParams) { return Boolean(params.q || params.priority !== "all" || params.type !== "all"); }
function tasksHref(params: TaskSearchParams) { const query = new URLSearchParams(); if (params.view !== "my") query.set("view", params.view); if (params.q) query.set("q", params.q); if (params.type !== "all") query.set("type", params.type); if (params.priority !== "all") query.set("priority", params.priority); if (params.sort !== "due_date") query.set("sort", params.sort); if (params.timezoneOffset !== 0 || params.tomorrowTimezoneOffset !== 0) { query.set("timezoneOffset", String(params.timezoneOffset)); query.set("tomorrowTimezoneOffset", String(params.tomorrowTimezoneOffset)); } if (params.page > 1) query.set("page", String(params.page)); const value = query.toString(); return `/app/tasks${value ? `?${value}` : ""}`; }
