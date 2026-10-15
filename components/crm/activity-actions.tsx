"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState, type FormEvent } from "react";
import { manualActivityTypes } from "@/lib/activities/manual";
import type { NoteActionClasses, NoteActionState } from "@/components/crm/note-actions";

export type ActivityActionState = NoteActionState;
type ActivityAction = (previous: ActivityActionState, form: FormData) => Promise<ActivityActionState>;
export type ActivityActionClasses = NoteActionClasses;

const defaultClasses: ActivityActionClasses = {
  button: "leads-secondary-button",
  primaryButton: "leads-primary-button",
  field: "leads-field",
  error: "contact-form-error",
  success: "contact-success",
};
const blankState: ActivityActionState = {};
const typeLabels: Record<(typeof manualActivityTypes)[number], string> = { call: "Call", email: "Email", meeting: "Meeting", note: "Note" };

type Mode = "view" | "edit" | "confirm-delete";

function localDateTimeInput(isoDateTime: string) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function captureLocalTimezoneOffset(event: FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const localDateTime = new FormData(form).get("occurredAt");
  const timezoneOffset = form.elements.namedItem("timezoneOffset");
  if (typeof localDateTime === "string" && localDateTime && timezoneOffset instanceof HTMLInputElement) {
    timezoneOffset.value = String(new Date(localDateTime).getTimezoneOffset());
  }
}

/**
 * Edit and delete controls for one manual activity. Render only for non-system activities the user
 * may modify; the server actions and database policies enforce the same rule independently.
 */
export function ActivityEditDeleteControls({ activity, entityIdName, entityId, updateAction, deleteAction, classes = defaultClasses }: {
  activity: { id: string; activity_type: string; subject: string | null; body: string | null; occurred_at: string };
  entityIdName: string;
  entityId: string;
  updateAction: ActivityAction;
  deleteAction: ActivityAction;
  classes?: ActivityActionClasses;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [updateState, updateFormAction, updating] = useActionState(updateAction, blankState);
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, blankState);

  useEffect(() => {
    if (!updateState.ok) return;
    setMode("view");
    router.refresh();
  }, [updateState, router]);
  useEffect(() => { if (deleteState.ok) router.refresh(); }, [deleteState, router]);

  const hiddenFields = <>
    <input name={entityIdName} type="hidden" value={entityId} />
    <input name="activityId" type="hidden" value={activity.id} />
  </>;
  const feedback = (state: ActivityActionState, show: boolean) => show && state.message
    ? <p aria-live="polite" className={state.ok ? classes.success : classes.error} role={state.ok ? "status" : "alert"}>{state.message}</p>
    : null;
  const fieldError = (name: string) => updateState.fieldErrors?.[name]?.[0];

  if (mode === "edit") {
    return <form action={updateFormAction} onSubmit={captureLocalTimezoneOffset}>
      {hiddenFields}
      <input defaultValue="" name="timezoneOffset" type="hidden" />
      <label className={classes.field} htmlFor={`${fieldId}-type`}><span>Activity type</span>
        <select defaultValue={activity.activity_type} id={`${fieldId}-type`} name="type">
          {manualActivityTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
        </select>
      </label>
      <label className={classes.field} htmlFor={`${fieldId}-subject`}><span>Subject</span>
        <input autoComplete="off" defaultValue={activity.subject ?? ""} id={`${fieldId}-subject`} maxLength={200} name="subject" required />
      </label>
      {fieldError("subject") && <p className={classes.error} role="alert">{fieldError("subject")}</p>}
      <label className={classes.field} htmlFor={`${fieldId}-body`}><span>Description</span>
        <textarea defaultValue={activity.body ?? ""} id={`${fieldId}-body`} maxLength={5000} name="body" rows={3} />
      </label>
      <label className={classes.field} htmlFor={`${fieldId}-occurred`}><span>Occurred at</span>
        <input defaultValue={localDateTimeInput(activity.occurred_at)} id={`${fieldId}-occurred`} name="occurredAt" required type="datetime-local" />
      </label>
      <button className={classes.primaryButton} disabled={updating} type="submit">{updating ? "Saving…" : "Save changes"}</button>
      <button className={classes.button} disabled={updating} onClick={() => setMode("view")} type="button">Cancel</button>
      {feedback(updateState, true)}
    </form>;
  }

  if (mode === "confirm-delete") {
    return <form action={deleteFormAction}>
      {hiddenFields}
      <p>Delete this activity? This cannot be undone.</p>
      <button className={classes.button} disabled={deleting} type="submit">{deleting ? "Deleting…" : "Confirm delete"}</button>
      <button className={classes.button} disabled={deleting} onClick={() => setMode("view")} type="button">Keep activity</button>
      {feedback(deleteState, true)}
    </form>;
  }

  return <>
    <button aria-label="Edit activity" className={classes.button} onClick={() => setMode("edit")} type="button">Edit</button>
    <button aria-label="Delete activity" className={classes.button} onClick={() => setMode("confirm-delete")} type="button">Delete</button>
    {feedback(updateState, Boolean(updateState.ok))}
  </>;
}
