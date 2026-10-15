"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode, type RefObject } from "react";
import { archiveDealAction, markDealLostAction, markDealWonAction, reopenDealAction, type DealActionResult } from "../actions";
import { addDealNoteAction, createDealFollowUpTaskAction, deleteDealNoteAction, logDealActivityAction, toggleDealNotePinAction, updateDealNoteAction, type DealEngagementActionState } from "./engagement-actions";
import { uploadDealFileAction, type DealFileActionState } from "./file-actions";
import type { DealDetail } from "@/lib/deals/repository";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { NoteEditDeleteControls, type NoteActionClasses } from "@/components/crm/note-actions";
import { formatCalendarDate, formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

type Props = { detail: DealDetail; canEdit: boolean; canEditAll?: boolean; currentUserId?: string; canArchive?: boolean; createNoteIntent?: boolean; createTaskIntent?: boolean };

function currencyAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function dateLabel(dateValue: string | null, dateFormat: DateFormat) {
  return dateValue ? formatCalendarDate(dateValue, dateFormat) : "Not set";
}

function timestampLabel(timestamp: string, dateFormat: DateFormat) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Unavailable" : formatCalendarDateTime(date, dateFormat, "UTC");
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="deal-detail-property"><dt>{label}</dt><dd>{children}</dd></div>;
}

type DealOutcomeDialogProps = {
  mode: "won" | "lost" | "reopen";
  detail: DealDetail;
  pending: boolean;
  actionResult: DealActionResult | null;
  wonDate: string;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function DealOutcomeFields({ mode, detail, wonDate }: Pick<DealOutcomeDialogProps, "mode" | "detail" | "wonDate">) {
  if (mode === "won") return <>
    <label className="deals-field">Final amount<input aria-label="Final amount" min="0" name="amount" required step="0.01" type="number" defaultValue={Number(detail.deal.amount)} /></label>
    <label className="deals-field">Won date<input aria-label="Won date" name="wonDate" required type="date" defaultValue={wonDate} /></label>
    <label className="deals-field">Closing note (optional)<textarea aria-label="Closing note" maxLength={2000} name="note" rows={3} /></label>
  </>;
  if (mode === "lost") return <>
    <label className="deals-field">Lost reason<select aria-label="Lost reason" defaultValue="" name="lostReasonId" required><option disabled value="">Choose a reason</option>{detail.lostReasons.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
    <label className="deals-field">Competitor or other context (optional)<input aria-label="Competitor or other context" maxLength={200} name="competitor" /></label>
    <label className="deals-field">Closing note (optional)<textarea aria-label="Closing note" maxLength={2000} name="note" rows={3} /></label>
    <label className="deals-field">Related open tasks<select aria-label="Related open tasks" defaultValue="" name="taskChoice" required><option disabled value="">Choose how to handle them</option><option value="keep">Keep open</option><option value="complete">Mark complete</option><option value="cancel">Cancel</option></select></label>
  </>;
  return <label className="deals-field">Reopen in stage<select aria-label="Reopen in stage" defaultValue={detail.openStages[0]?.id ?? ""} name="stageId" required>{detail.openStages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function DealOutcomeDialog({ mode, detail, pending, actionResult, wonDate, dialogRef, onClose, onSubmit }: DealOutcomeDialogProps) {
  const { deal } = detail;
  return <dialog aria-labelledby="deal-outcome-title" className="deals-dialog" onClose={onClose} ref={dialogRef}>
    <form className="deals-form deal-outcome-form" onSubmit={onSubmit}>
      <header className="deals-dialog-header"><div><h2 id="deal-outcome-title">{mode === "won" ? "Mark deal won" : mode === "lost" ? "Mark deal lost" : "Reopen deal"}</h2><p>{deal.title}</p></div><button aria-label="Close dialog" className="deals-icon-button" disabled={pending} onClick={onClose} type="button">Close</button></header>
      <input name="id" type="hidden" value={deal.id} />
      <DealOutcomeFields mode={mode} detail={detail} wonDate={wonDate} />
      {actionResult && <p aria-live="polite" className={actionResult.ok ? "deal-outcome-notice" : "deal-outcome-error"} role={actionResult.ok ? "status" : "alert"}>{actionResult.message}</p>}
      <footer className="deals-form-actions"><button className="deals-button deals-button-secondary" disabled={pending} onClick={onClose} type="button">Cancel</button><button className={`deals-button ${mode === "won" ? "deal-outcome-won" : mode === "lost" ? "deal-outcome-lost" : "deals-button-primary"}`} disabled={pending} type="submit">{pending ? "Saving…" : mode === "won" ? "Mark Won" : mode === "lost" ? "Mark Lost" : "Reopen deal"}</button></footer>
    </form>
  </dialog>;
}

function DealOutcomeControls({ detail, canEdit }: { detail: DealDetail; canEdit: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"won" | "lost" | "reopen" | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<DealActionResult | null>(null);
  const [wonDate, setWonDate] = useState("");
  const { deal } = detail;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !mode) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [mode]);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setMode(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;
    const formData = new FormData(event.currentTarget);
    setActionResult(null);
    startTransition(async () => {
      try {
        const action = mode === "won" ? markDealWonAction : mode === "lost" ? markDealLostAction : reopenDealAction;
        const response = await action(formData);
        setActionResult(response);
        if (response.ok) {
          closeDialog();
          router.refresh();
        }
      } catch {
        setActionResult({ ok: false, message: "The request could not be completed. Check your connection and try again." });
      }
    });
  }

  function open(next: "won" | "lost" | "reopen") {
    setActionResult(null);
    if (next === "won") setWonDate(deal.expected_close_date ?? new Date().toISOString().slice(0, 10));
    setMode(next);
  }

  return <>
    <div aria-label="Deal outcome actions" className="deal-outcome-actions" role="group">
      {deal.status === "open" ? <>
        <button className="deals-button deal-outcome-won" disabled={!canEdit || pending} onClick={() => open("won")} title={!canEdit ? "You do not have permission to change this deal." : undefined} type="button">Mark Won</button>
        <button className="deals-button deal-outcome-lost" disabled={!canEdit || pending} onClick={() => open("lost")} title={!canEdit ? "You do not have permission to change this deal." : undefined} type="button">Mark Lost</button>
      </> : <button className="deals-button deals-button-secondary" disabled={!canEdit || pending || detail.openStages.length === 0} onClick={() => open("reopen")} title={!canEdit ? "You do not have permission to change this deal." : detail.openStages.length === 0 ? "No active open stage is available." : undefined} type="button">Reopen deal</button>}
    </div>
    {!canEdit && <p className="deal-outcome-permission">Outcome changes are unavailable because you cannot edit this deal.</p>}
    {actionResult && !mode && <p aria-live="polite" className={actionResult.ok ? "deal-outcome-notice" : "deal-outcome-error"} role={actionResult.ok ? "status" : "alert"}>{actionResult.message}</p>}
    {mode && <DealOutcomeDialog mode={mode} detail={detail} pending={pending} actionResult={actionResult} wonDate={wonDate} dialogRef={dialogRef} onClose={closeDialog} onSubmit={submit} />}
  </>;
}

const blankEngagementState: DealEngagementActionState = {};

function captureLocalTimezoneOffset(event: FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const formData = new FormData(form);
  const localDateTime = formData.get("occurredAt") ?? formData.get("dueAt");
  const timezoneOffset = form.elements.namedItem("timezoneOffset");
  if (typeof localDateTime === "string" && timezoneOffset instanceof HTMLInputElement) {
    timezoneOffset.value = String(new Date(localDateTime).getTimezoneOffset());
  }
}

function localDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function EngagementActions({ detail, canEdit, createNoteIntent = false, createTaskIntent = false }: Props) {
  const router = useRouter();
  const [activityState, activityAction, activityPending] = useActionState(logDealActivityAction, blankEngagementState);
  const [taskState, taskAction, taskPending] = useActionState(createDealFollowUpTaskAction, blankEngagementState);
  const [noteState, noteAction, notePending] = useActionState(addDealNoteAction, blankEngagementState);
  useEffect(() => {
    if (activityState.ok || taskState.ok || noteState.ok) router.refresh();
  }, [activityState.ok, taskState.ok, noteState.ok, router]);
  if (!canEdit) return <p className="deal-engagement-permission">Engagement actions are unavailable because you cannot edit this deal.</p>;
  return <div aria-label="Deal engagement actions" className="deal-engagement-actions">
    <details>
      <summary className="deals-button deals-button-secondary">Log activity</summary>
      <form action={activityAction} className="deals-form" onSubmit={captureLocalTimezoneOffset}>
        <input name="dealId" type="hidden" value={detail.deal.id} /><input name="timezoneOffset" type="hidden" value="" />
        <label className="deals-field">Activity type<select defaultValue="call" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select></label>
        <label className="deals-field">Subject<input maxLength={200} name="subject" required /></label>
        <label className="deals-field">Description<textarea maxLength={5000} name="body" rows={3} /></label>
        <label className="deals-field">Occurred at<input defaultValue={localDateTimeInput(new Date())} name="occurredAt" required type="datetime-local" /></label>
        <button className="deals-button deals-button-primary" disabled={activityPending} type="submit">{activityPending ? "Saving…" : "Save activity"}</button>
        {activityState.message && <p aria-live="polite" className={activityState.ok ? "deal-engagement-success" : "deal-engagement-error"} role={activityState.ok ? "status" : "alert"}>{activityState.message}</p>}
      </form>
    </details>
    {detail.deal.status === "open" && <details open={createTaskIntent}>
      <summary className="deals-button deals-button-secondary">Add follow-up task</summary>
      <form action={taskAction} className="deals-form" onSubmit={captureLocalTimezoneOffset}>
        <input name="dealId" type="hidden" value={detail.deal.id} /><input name="timezoneOffset" type="hidden" value="" />
        <label className="deals-field">Task title<input maxLength={200} name="title" required /></label>
        <div className="deals-form-grid">
          <label className="deals-field">Type<select defaultValue="follow_up" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option><option value="to_do">To-do</option></select></label>
          <label className="deals-field">Priority<select defaultValue="medium" name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <label className="deals-field">Description<textarea maxLength={5000} name="description" rows={3} /></label>
        <label className="deals-field">Due at<input defaultValue={localDateTimeInput(new Date(Date.now() + 86_400_000))} name="dueAt" required type="datetime-local" /></label>
        <button className="deals-button deals-button-primary" disabled={taskPending} type="submit">{taskPending ? "Saving…" : "Create task"}</button>
        {taskState.message && <p aria-live="polite" className={taskState.ok ? "deal-engagement-success" : "deal-engagement-error"} role={taskState.ok ? "status" : "alert"}>{taskState.message}</p>}
      </form>
    </details>}
    <details open={createNoteIntent}>
      <summary className="deals-button deals-button-secondary">Add note</summary>
      <form action={noteAction} className="deals-form">
        <input name="dealId" type="hidden" value={detail.deal.id} />
        <label className="deals-field">Note<textarea maxLength={10000} name="body" required rows={5} /></label>
        <button className="deals-button deals-button-primary" disabled={notePending} type="submit">{notePending ? "Saving…" : "Save note"}</button>
        {noteState.message && <p aria-live="polite" className={noteState.ok ? "deal-engagement-success" : "deal-engagement-error"} role={noteState.ok ? "status" : "alert"}>{noteState.message}</p>}
      </form>
    </details>
  </div>;
}

const dealNoteClasses: NoteActionClasses = { button: "deals-button deals-button-secondary", primaryButton: "deals-button deals-button-primary", field: "deals-field", error: "", success: "" };

function DealNote({ note, dealId, canModify, dateFormat }: { note: DealDetail["notes"][number]; dealId: string; canModify: boolean; dateFormat: DateFormat }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(toggleDealNotePinAction, blankEngagementState);
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, state.message, router]);
  return <article>
    {note.is_pinned && <strong>Pinned</strong>}
    <p>{note.body}</p>
    <p>By {note.author}</p>
    <time dateTime={note.created_at}>Created {timestampLabel(note.created_at, dateFormat)}</time>
    {note.updated_at !== note.created_at && <time dateTime={note.updated_at}> · Updated {timestampLabel(note.updated_at, dateFormat)}</time>}
    {canModify && <form action={action}>
      <input name="dealId" type="hidden" value={dealId} />
      <input name="noteId" type="hidden" value={note.id} />
      <button className="deals-button deals-button-secondary" disabled={pending} type="submit">{pending ? "Saving…" : note.is_pinned ? "Unpin note" : "Pin note"}</button>
      {state.message && <span aria-live="polite" role={state.ok ? "status" : "alert"}>{state.message}</span>}
    </form>}
    {canModify && <NoteEditDeleteControls classes={dealNoteClasses} deleteAction={deleteDealNoteAction} entityId={dealId} entityIdName="dealId" note={note} updateAction={updateDealNoteAction} />}
  </article>;
}

function fileSizeLabel(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DealFiles({ detail, canEdit, dateFormat }: { detail: DealDetail; canEdit: boolean; dateFormat: DateFormat }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadDealFileAction, {} as DealFileActionState);
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, state.message, router]);
  return <section aria-labelledby="deal-files-heading" className="deal-detail-section deal-detail-files" id="deal-files">
    <h2 id="deal-files-heading">Files</h2>
    {canEdit && <form action={action} className="deal-file-upload">
      <input name="dealId" type="hidden" value={detail.deal.id} />
      <label className="deals-field">Upload a file<input accept=".pdf,.txt,.csv,.docx,.xlsx,.pptx" name="file" required type="file" /></label>
      <button className="deals-button deals-button-primary" disabled={pending} type="submit">{pending ? "Uploading…" : "Upload file"}</button>
      {state.message && <p aria-live="polite" className={state.ok ? "deal-engagement-success" : "deal-engagement-error"} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    </form>}
    {detail.attachments.length ? <ul className="deal-file-list">{detail.attachments.map((file) => <li key={file.id}>
      <div><a href={`/app/deals/files/${file.id}`}>{file.filename}</a><span>{file.mime_type} · {fileSizeLabel(file.size_bytes)} · Added {timestampLabel(file.created_at, dateFormat)}</span></div>
    </li>)}</ul> : <p className="deal-activity-empty">No files have been added to this deal yet.</p>}
  </section>;
}

function DealArchiveControl({ dealId, title, canArchive }: { dealId: string; title: string; canArchive: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<DealActionResult | null>(null);
  const dialogOpen = actionResult !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [dialogOpen]);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setActionResult(null);
  }

  function archive() {
    const formData = new FormData();
    formData.set("id", dealId);
    startTransition(async () => {
      try {
        const response = await archiveDealAction(formData);
        setActionResult(response);
        if (response.ok) router.push("/app/deals");
      } catch {
        setActionResult({ ok: false, message: "The request could not be completed. Check your connection and try again." });
      }
    });
  }

  if (!canArchive) return null;
  return <>
    <button className="deals-button deals-button-secondary" onClick={() => setActionResult({ ok: false, message: "" })} type="button">Archive deal</button>
    {actionResult && <dialog aria-describedby="archive-deal-description" aria-labelledby="archive-deal-title" className="deals-dialog" onClose={closeDialog} ref={dialogRef} role="alertdialog">
      <form className="deals-form" onSubmit={(event) => { event.preventDefault(); archive(); }}>
        <header className="deals-dialog-header"><div><h2 id="archive-deal-title">Archive {title}?</h2><p id="archive-deal-description">This deal will be removed from the active deals list. Related records will remain in the workspace.</p></div><button aria-label="Close dialog" className="deals-icon-button" disabled={pending} onClick={closeDialog} type="button">Close</button></header>
        {actionResult.message && <p aria-live="polite" className="deal-outcome-error" role="alert">{actionResult.message}</p>}
        <footer className="deals-form-actions"><button className="deals-button deals-button-secondary" disabled={pending} onClick={closeDialog} type="button">Cancel</button><button className="deals-button deal-outcome-lost" disabled={pending} type="submit">{pending ? "Archiving…" : "Archive deal"}</button></footer>
      </form>
    </dialog>}
  </>;
}

export function DealDetailWorkspace({ detail, canEdit, canEditAll = false, currentUserId = "", canArchive = false, createNoteIntent, createTaskIntent }: Props) {
  const dateFormat = useDateFormat();
  const { deal, company, contact, stage, pipeline, ownerLabel, source } = detail;
  return (
    <div className="page-container deals-page deal-detail-page">
      <nav aria-label="Breadcrumb" className="deal-detail-breadcrumb">
        <Link href="/app/deals">Deals</Link><span aria-hidden="true">/</span><span aria-current="page">{deal.title}</span>
      </nav>

      <header className="deal-detail-header">
        <div className="deal-detail-heading">
          <h1 className="page-title">{deal.title}</h1>
          <div className="deal-detail-relations">
            {company ? <Link href={`/app/companies/${company.id}`}>{company.name}</Link> : <span>No company linked</span>}
            {contact ? <><span aria-hidden="true">·</span><Link href={`/app/contacts/${contact.id}`}>{contact.full_name}</Link></> : <><span aria-hidden="true">·</span><span>No primary contact</span></>}
          </div>
        </div>
        <div className="deal-detail-header-actions"><DealOutcomeControls canEdit={canEdit} detail={detail} /><DealArchiveControl canArchive={canArchive} dealId={deal.id} title={deal.title} /><Link className="deals-button deals-button-secondary deal-detail-back" href="/app/deals">Back to Deals</Link></div>
      </header>

      <section aria-label="Deal overview" className="deal-detail-overview">
        <div><span>Deal value</span><strong>{currencyAmount(Number(deal.amount), deal.currency)}</strong></div>
        <div><span>Probability</span><strong>{deal.probability}%</strong></div>
        <div><span>Expected close</span><strong>{dateLabel(deal.expected_close_date, dateFormat)}</strong></div>
        <div><span>Stage</span><strong>{stage?.name ?? "Stage unavailable"}</strong></div>
      </section>

      <div className="deal-detail-grid">
        <section aria-labelledby="deal-summary-heading" className="deal-detail-section">
          <h2 id="deal-summary-heading">Overview</h2>
          <p className="deal-detail-description">{deal.description || "No description provided."}</p>
          <div className="deal-detail-relationships">
            <h3>Relationships</h3>
            <dl>
              <Property label="Company">{company ? <Link href={`/app/companies/${company.id}`}>{company.name}</Link> : "No company linked"}</Property>
              <Property label="Primary contact">{contact ? <Link href={`/app/contacts/${contact.id}`}>{contact.full_name}</Link> : "No primary contact"}</Property>
              <Property label="Related files"><a href="#deal-files">{detail.attachments.length ? `${detail.attachments.length} file${detail.attachments.length === 1 ? "" : "s"}` : "View files"}</a></Property>
            </dl>
          </div>
        </section>

        <aside aria-labelledby="deal-properties-heading" className="deal-detail-section deal-detail-properties">
          <h2 id="deal-properties-heading">Properties</h2>
          <dl>
            <Property label="Stage">{stage?.name ?? "Unavailable"}</Property>
            <Property label="Pipeline">{pipeline?.name ?? "Unavailable"}</Property>
            <Property label="Deal value">{currencyAmount(Number(deal.amount), deal.currency)}</Property>
            <Property label="Probability">{deal.probability}%</Property>
            <Property label="Expected close">{dateLabel(deal.expected_close_date, dateFormat)}</Property>
            <Property label="Owner">{ownerLabel}</Property>
            <Property label="Tags">{detail.tags.length ? <span aria-label="Tags" className="contact-tag-list">{detail.tags.map((tag) => <span className="contact-tag" key={tag.id}>{tag.name}</span>)}</span> : "No tags"}</Property>
            <Property label="Priority">{deal.priority[0].toUpperCase() + deal.priority.slice(1)}</Property>
            <Property label="Status">{deal.status[0].toUpperCase() + deal.status.slice(1)}</Property>
            {source && <Property label="Source">{source}</Property>}
            <Property label="Created">{timestampLabel(deal.created_at, dateFormat)}</Property>
            <Property label="Last updated">{timestampLabel(deal.updated_at, dateFormat)}</Property>
          </dl>
        </aside>
      </div>

      <section aria-label="Deal engagement" className="deal-detail-section deal-detail-engagement">
        <h2>Engagement</h2>
        <EngagementActions canEdit={canEdit} createNoteIntent={createNoteIntent} createTaskIntent={createTaskIntent} detail={detail} />
      </section>

      <section aria-labelledby="deal-activity-heading" className="deal-detail-section deal-detail-activity">
        <h2 id="deal-activity-heading">Activity timeline</h2>
        {detail.activities.length ? <ol className="deal-activity-list">{detail.activities.map((activity) => <li key={activity.id}>
          <div><strong>{activity.subject || activity.activity_type.replaceAll("_", " ")}</strong><time dateTime={activity.occurred_at}>{timestampLabel(activity.occurred_at, dateFormat)}</time></div>
          {activity.body && <p>{activity.body}</p>}
        </li>)}</ol> : <p className="deal-activity-empty">No activity recorded for this deal yet.</p>}
      </section>

      <section aria-labelledby="deal-notes-heading" className="deal-detail-section deal-detail-activity">
        <h2 id="deal-notes-heading">Notes</h2>
        {detail.notes.length ? <div className="deal-notes-list">{detail.notes.map((note) => <DealNote canModify={canEdit && (canEditAll || note.created_by === currentUserId)} dateFormat={dateFormat} dealId={deal.id} key={note.id} note={note} />)}</div> : <p className="deal-activity-empty">No notes have been added to this deal yet.</p>}
      </section>

      <section aria-labelledby="deal-tasks-heading" className="deal-detail-section deal-detail-activity">
        <h2 id="deal-tasks-heading">Follow-up tasks</h2>
        {detail.tasks.length ? <ul className="deal-task-list">{detail.tasks.map((task) => <li key={task.id}>
          <div><strong>{task.title}</strong><span>{task.task_type.replaceAll("_", " ")} · {task.priority} priority{task.due_at ? ` · Due ${timestampLabel(task.due_at, dateFormat)}` : ""}</span>{task.description && <span>{task.description}</span>}</div><span className={`deal-task-status status-${task.status}`}>{task.status}</span>
        </li>)}</ul> : <p className="deal-activity-empty">No follow-up tasks have been created for this deal yet.</p>}
      </section>

      <DealFiles canEdit={canEdit} dateFormat={dateFormat} detail={detail} />
    </div>
  );
}
