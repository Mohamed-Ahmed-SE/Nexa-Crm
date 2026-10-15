"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate, type DateFormat } from "@/lib/preferences/date-format";
import type { FormEvent, ReactNode } from "react";
import type { LeadDetail } from "@/lib/leads/repository";
import { statusLabels } from "@/lib/leads/schema";
import { createTaskAction } from "../tasks/actions";
import { NoteEditDeleteControls } from "@/components/crm/note-actions";
import { addLeadNoteAction, deleteLeadNoteAction, logLeadActivityAction, updateLeadNoteAction, type LeadEngagementActionState } from "./engagement-actions";

const blankState: LeadEngagementActionState = {};

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatTimestamp(value: string, dateFormat: DateFormat) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatCalendarDate(date, dateFormat, { timeZone: "UTC" });
}

function localDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function captureLocalTimezoneOffset(event: FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const formData = new FormData(form);
  const localDateTime = formData.get("occurredAt") ?? formData.get("dueAt");
  const timezoneOffset = form.elements.namedItem("timezoneOffset");
  if (typeof localDateTime === "string" && timezoneOffset instanceof HTMLInputElement) {
    timezoneOffset.value = String(new Date(localDateTime).getTimezoneOffset());
  }
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="contact-property"><span>{label}</span><div>{children}</div></div>;
}

function ActionFeedback({ message }: { message?: string }) {
  return message ? <p aria-live="polite" className="leads-form-message">{message}</p> : null;
}

function EngagementActions({ leadId, owners, canReassign, createNoteIntent, createTaskIntent }: { leadId: string; owners: LeadDetail["owners"]; canReassign: boolean; createNoteIntent: boolean; createTaskIntent: boolean }) {
  const router = useRouter();
  const [activityState, activityAction, activityPending] = useActionState(logLeadActivityAction, blankState);
  const [noteState, noteAction, notePending] = useActionState(addLeadNoteAction, blankState);
  const [taskState, taskAction, taskPending] = useActionState(createTaskAction, blankState);

  useEffect(() => {
    if (activityState.ok || noteState.ok || taskState.ok) router.refresh();
  }, [activityState.ok, noteState.ok, taskState.ok, router]);

  return <div className="contact-header-actions" aria-label="Lead engagement actions">
    <details>
      <summary className="leads-secondary-button">Log activity</summary>
      <form action={activityAction} className="leads-form" onSubmit={captureLocalTimezoneOffset}>
        <input name="leadId" type="hidden" value={leadId} />
        <input name="timezoneOffset" type="hidden" value="" />
        <label className="leads-field"><span>Activity type</span><select defaultValue="call" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select></label>
        <label className="leads-field"><span>Subject</span><input autoComplete="off" maxLength={200} name="subject" required /></label>
        <label className="leads-field"><span>Description</span><textarea maxLength={5000} name="body" rows={3} /></label>
        <label className="leads-field"><span>Occurred at</span><input defaultValue={localDateTimeInput(new Date())} name="occurredAt" required type="datetime-local" /></label>
        <button className="leads-primary-button" disabled={activityPending} type="submit">{activityPending ? "Saving…" : "Save activity"}</button>
        <ActionFeedback message={activityState.message} />
      </form>
    </details>
    <details open={createTaskIntent}>
      <summary className="leads-secondary-button">Add follow-up task</summary>
      <form action={taskAction} className="leads-form" onSubmit={captureLocalTimezoneOffset}>
        <input name="relatedType" type="hidden" value="lead" />
        <input name="relatedId" type="hidden" value={leadId} />
        <input name="timezoneOffset" type="hidden" value="" />
        <label className="leads-field"><span>Task title</span><input maxLength={200} name="title" required /></label>
        <div className="leads-form-grid">
          <label className="leads-field"><span>Type</span><select defaultValue="follow_up" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option><option value="to_do">To-do</option></select></label>
          <label className="leads-field"><span>Priority</span><select defaultValue="medium" name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        {canReassign && <label className="leads-field"><span>Assign to</span><select defaultValue="" name="assignedTo"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>}
        <label className="leads-field"><span>Description</span><textarea maxLength={5000} name="description" rows={3} /></label>
        <label className="leads-field"><span>Due at</span><input defaultValue={localDateTimeInput(new Date(Date.now() + 86_400_000))} name="dueAt" required type="datetime-local" /></label>
        <button className="leads-primary-button" disabled={taskPending} type="submit">{taskPending ? "Saving…" : "Create task"}</button>
        <ActionFeedback message={taskState.message} />
      </form>
    </details>
    <details open={createNoteIntent}>
      <summary className="leads-secondary-button">Add note</summary>
      <form action={noteAction} className="leads-form">
        <input name="leadId" type="hidden" value={leadId} />
        <label className="leads-field"><span>Note</span><textarea maxLength={10000} name="body" required rows={5} /></label>
        <button className="leads-primary-button" disabled={notePending} type="submit">{notePending ? "Saving…" : "Save note"}</button>
        <ActionFeedback message={noteState.message} />
      </form>
    </details>
  </div>;
}

export function LeadDetailWorkspace({ detail, canEdit = false, canEditAll = false, currentUserId = "", canReassign = false, createNoteIntent = false, createTaskIntent = false }: { detail: LeadDetail; canEdit?: boolean; canEditAll?: boolean; currentUserId?: string; canReassign?: boolean; createNoteIntent?: boolean; createTaskIntent?: boolean }) {
  const dateFormat = useDateFormat();
  const { lead, source, ownerLabel } = detail;
  const createdAt = formatTimestamp(lead.created_at, dateFormat);
  const updatedAt = formatTimestamp(lead.updated_at, dateFormat);

  return <main className="page-container leads-page contact-detail-page">
    <div className="contact-breadcrumb"><nav aria-label="Breadcrumb"><Link href="/app/leads">← Back to Leads</Link></nav></div>
    <section className="contact-hero">
      <div className="contact-hero-copy">
        <div className="contact-name-line"><h1>{lead.full_name}</h1><span className="contact-deal-status">{statusLabels[lead.status]}</span></div>
        {lead.company_name && <p>{lead.company_name}</p>}
      </div>
      {canEdit && <EngagementActions canReassign={canReassign} createNoteIntent={createNoteIntent} createTaskIntent={createTaskIntent} leadId={lead.id} owners={detail.owners} />}
    </section>
    <div className="contact-detail-grid">
      <div className="contact-detail-main">
        <section aria-label="Lead information" className="contact-section">
          <h2 className="contact-section-heading">Lead information</h2>
          {lead.job_title && <Property label="Job title">{lead.job_title}</Property>}
          {lead.email && <Property label="Email"><a href={`mailto:${lead.email}`}>{lead.email}</a></Property>}
          {lead.phone && <Property label="Phone"><a href={`tel:${lead.phone}`}>{lead.phone}</a></Property>}
          {lead.notes_summary && <Property label="Notes summary">{lead.notes_summary}</Property>}
          {!lead.job_title && !lead.email && !lead.phone && !lead.notes_summary && <p className="contact-muted">No additional information is recorded for this lead.</p>}
        </section>
        <section aria-label="Lead activity timeline" className="contact-section">
          <h2 className="contact-section-heading"><span>Activity timeline</span></h2>
          {detail.activities.length ? <ol className="contact-timeline">{detail.activities.map((activity) => {
            const occurred = formatTimestamp(activity.occurred_at, dateFormat);
            return <li key={activity.id}><span aria-hidden="true" className="contact-timeline-marker" /><div>
              <div className="contact-activity-title"><strong>{activity.subject || activity.activity_type.replaceAll("_", " ")}</strong>{occurred && <time dateTime={activity.occurred_at}>{occurred}</time>}</div>
              <span className="contact-activity-type">{activity.activity_type.replaceAll("_", " ")}{activity.is_system_event ? " · Nexa CRM" : ""}</span>
              {activity.body && <p>{activity.body}</p>}
            </div></li>;
          })}</ol> : <p className="contact-muted">No activity has been recorded for this lead yet.</p>}
        </section>
        <section aria-label="Lead notes" className="contact-section">
          <h2 className="contact-section-heading"><span>Notes</span></h2>
          {detail.notes.length ? <div className="contact-notes">{detail.notes.map((note) => {
            const created = formatTimestamp(note.created_at, dateFormat);
            return <article key={note.id}>{note.is_pinned && <strong>Pinned</strong>}<p>{note.body}</p>{created && <time dateTime={note.created_at}>{created}</time>}{canEdit && (canEditAll || note.created_by === currentUserId) && <NoteEditDeleteControls deleteAction={deleteLeadNoteAction} entityId={lead.id} entityIdName="leadId" note={note} updateAction={updateLeadNoteAction} />}</article>;
          })}</div> : <p className="contact-muted">No notes have been added to this lead yet.</p>}
        </section>
        <section aria-label="Lead tasks" className="contact-section">
          <h2 className="contact-section-heading"><span>Follow-up tasks</span></h2>
          {detail.tasks.length ? <ul className="contact-task-list">{detail.tasks.map((task) => {
            const due = task.due_at ? formatTimestamp(task.due_at, dateFormat) : null;
            return <li key={task.id}><div><strong>{task.title}</strong><span>{task.task_type.replaceAll("_", " ")} · {task.priority} priority{due ? ` · Due ${due}` : ""}</span>{task.description && <span>{task.description}</span>}</div><span className={`contact-deal-status status-${task.status}`}>{task.status}</span></li>;
          })}</ul> : <p className="contact-muted">No follow-up tasks have been created for this lead yet.</p>}
        </section>
      </div>
      <aside aria-label="Lead properties" className="contact-detail-rail">
        <section className="contact-rail-section">
          <h2 className="contact-section-heading">Properties</h2>
          <Property label="Estimated value">{formatCurrency(Number(lead.estimated_value), lead.currency)}</Property>
          {ownerLabel && <Property label="Owner">{ownerLabel}</Property>}
          {source && <Property label="Source">{source}</Property>}
          {createdAt && <Property label="Created"><time dateTime={lead.created_at}>{createdAt}</time></Property>}
          {updatedAt && <Property label="Updated"><time dateTime={lead.updated_at}>{updatedAt}</time></Property>}
        </section>
      </aside>
    </div>
  </main>;
}
