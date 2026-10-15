"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";

export type NoteActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
type NoteAction = (previous: NoteActionState, form: FormData) => Promise<NoteActionState>;
export type NoteActionClasses = { button: string; primaryButton: string; field: string; error: string; success: string };

const defaultClasses: NoteActionClasses = {
  button: "leads-secondary-button",
  primaryButton: "leads-primary-button",
  field: "leads-field",
  error: "contact-form-error",
  success: "contact-success",
};
const blankState: NoteActionState = {};

type Mode = "view" | "edit" | "confirm-delete";

/**
 * Edit and delete controls for one CRM note. Render only for users allowed to modify the note;
 * the server actions enforce the same rule independently.
 */
export function NoteEditDeleteControls({ note, entityIdName, entityId, updateAction, deleteAction, classes = defaultClasses }: {
  note: { id: string; body: string };
  entityIdName: string;
  entityId: string;
  updateAction: NoteAction;
  deleteAction: NoteAction;
  classes?: NoteActionClasses;
}) {
  const router = useRouter();
  const textareaId = useId();
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
    <input name="noteId" type="hidden" value={note.id} />
  </>;
  const feedback = (state: NoteActionState, show: boolean) => show && state.message
    ? <p aria-live="polite" className={state.ok ? classes.success : classes.error} role={state.ok ? "status" : "alert"}>{state.message}</p>
    : null;

  if (mode === "edit") {
    return <form action={updateFormAction}>
      {hiddenFields}
      <label className={classes.field} htmlFor={textareaId}><span>Edit note text</span>
        <textarea defaultValue={note.body} id={textareaId} maxLength={10000} name="body" required rows={4} />
      </label>
      <button className={classes.primaryButton} disabled={updating} type="submit">{updating ? "Saving…" : "Save changes"}</button>
      <button className={classes.button} disabled={updating} onClick={() => setMode("view")} type="button">Cancel</button>
      {feedback(updateState, true)}
    </form>;
  }

  if (mode === "confirm-delete") {
    return <form action={deleteFormAction}>
      {hiddenFields}
      <p>Delete this note? This cannot be undone.</p>
      <button className={classes.button} disabled={deleting} type="submit">{deleting ? "Deleting…" : "Confirm delete"}</button>
      <button className={classes.button} disabled={deleting} onClick={() => setMode("view")} type="button">Keep note</button>
      {feedback(deleteState, true)}
    </form>;
  }

  return <>
    <button aria-label="Edit note" className={classes.button} onClick={() => setMode("edit")} type="button">Edit</button>
    <button aria-label="Delete note" className={classes.button} onClick={() => setMode("confirm-delete")} type="button">Delete</button>
    {feedback(updateState, Boolean(updateState.ok))}
  </>;
}
