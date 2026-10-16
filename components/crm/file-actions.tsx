"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { NoteActionClasses, NoteActionState } from "@/components/crm/note-actions";

export type FileActionState = NoteActionState;
type FileDeleteAction = (previous: FileActionState, form: FormData) => Promise<FileActionState>;
export type FileActionClasses = NoteActionClasses;

const defaultClasses: FileActionClasses = {
  button: "leads-secondary-button",
  primaryButton: "leads-primary-button",
  field: "leads-field",
  error: "contact-form-error",
  success: "contact-success",
};
const blankState: FileActionState = {};

type Mode = "view" | "confirm-delete";

/**
 * Delete control for one attachment, with an inline confirmation step. Render only for users
 * allowed to modify the attachment; the server action and database/storage policies enforce the
 * same rule independently.
 */
export function FileDeleteControl({ file, entityIdName, entityId, deleteAction, classes = defaultClasses }: {
  file: { id: string; filename: string };
  entityIdName: string;
  entityId: string;
  deleteAction: FileDeleteAction;
  classes?: FileActionClasses;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, blankState);

  useEffect(() => { if (deleteState.ok) router.refresh(); }, [deleteState, router]);

  const hiddenFields = <>
    <input name={entityIdName} type="hidden" value={entityId} />
    <input name="fileId" type="hidden" value={file.id} />
  </>;
  const feedback = deleteState.message
    ? <p aria-live="polite" className={deleteState.ok ? classes.success : classes.error} role={deleteState.ok ? "status" : "alert"}>{deleteState.message}</p>
    : null;

  if (mode === "confirm-delete") {
    return <form action={deleteFormAction} className="contact-file-delete-confirm">
      {hiddenFields}
      <p>Delete {file.filename}? This cannot be undone.</p>
      <button className={classes.button} disabled={deleting} type="submit">{deleting ? "Deleting…" : "Confirm delete"}</button>
      <button className={classes.button} disabled={deleting} onClick={() => setMode("view")} type="button">Keep file</button>
      {feedback}
    </form>;
  }

  return <>
    <button aria-label={`Delete ${file.filename}`} className={classes.button} onClick={() => setMode("confirm-delete")} type="button">Delete</button>
    {feedback}
  </>;
}
