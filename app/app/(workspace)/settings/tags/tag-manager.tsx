"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTagAction, deleteTagAction, renameTagAction, type TagActionState } from "./actions";
import styles from "./tag-manager.module.css";

export type WorkspaceTag = { id: string; name: string; color_token: string | null };

const emptyActionState: TagActionState = {};

function TagRow({ tag, onRemoved }: { tag: WorkspaceTag; onRemoved: (message: string) => void }) {
  const router = useRouter();
  const [renameState, renameFormAction, renaming] = useActionState(renameTagAction, emptyActionState);
  const [deleteState, setDeleteState] = useState<TagActionState>({});
  const [removing, startRemove] = useTransition();
  const nameError = renameState.fieldErrors?.name?.[0];

  useEffect(() => {
    if (renameState.ok) router.refresh();
  }, [renameState.ok, router]);

  function confirmRemoval() {
    if (!window.confirm(`Remove “${tag.name}”? Any assignments to this tag will be removed too.`)) return;
    startRemove(async () => {
      const result = await deleteTagAction(tag.id);
      setDeleteState(result);
      if (result.ok) {
        onRemoved(result.message ?? "Tag removed.");
        router.refresh();
      }
    });
  }

  return (
    <li className={styles.row}>
      <strong className={styles.name}>{tag.name}</strong>
      <form action={renameFormAction} className={styles.tagForm}>
        <input name="tagId" type="hidden" value={tag.id} />
        <label className={styles.field}>
          <span className="sr-only">Rename {tag.name}</span>
          <input aria-describedby={nameError ? `tag-${tag.id}-error` : undefined} aria-invalid={Boolean(nameError)} defaultValue={tag.name} maxLength={80} name="name" required />
          {nameError && <small className={styles.error} id={`tag-${tag.id}-error`}>{nameError}</small>}
        </label>
        <button className={styles.button} disabled={renaming || removing} type="submit">{renaming ? "Saving…" : "Save name"}</button>
        <button className={styles.removeButton} disabled={renaming || removing} onClick={confirmRemoval} type="button">{removing ? "Removing…" : "Remove"}</button>
      </form>
      {(renameState.message || deleteState.message) && (
        <p aria-live="polite" className={`${styles.feedback} ${(renameState.ok || deleteState.ok) ? styles.success : ""}`} role={renameState.ok || deleteState.ok ? "status" : "alert"}>
          {deleteState.message ?? renameState.message}
        </p>
      )}
    </li>
  );
}

export function TagManager({ tags }: { tags: WorkspaceTag[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createTagAction, emptyActionState);
  const [removalMessage, setRemovalMessage] = useState("");
  const nameError = state.fieldErrors?.name?.[0];

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <section aria-label="Manage workspace tags" className={styles.manager}>
      <form action={formAction} className={styles.createForm}>
        <label className={styles.field}>
          <span>New tag name</span>
          <input aria-describedby={nameError ? "new-tag-error" : undefined} aria-invalid={Boolean(nameError)} maxLength={80} name="name" required />
          {nameError && <small className={styles.error} id="new-tag-error">{nameError}</small>}
        </label>
        <button className={`${styles.button} ${styles.createButton}`} disabled={pending} type="submit">{pending ? "Creating…" : "Create tag"}</button>
      </form>
      {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
      {removalMessage && <p aria-live="polite" className={`${styles.feedback} ${styles.success}`} role="status">{removalMessage}</p>}
      {tags.length ? (
        <ul aria-label="Workspace tags" className={styles.list}>
          {tags.map((tag) => <TagRow key={tag.id} onRemoved={setRemovalMessage} tag={tag} />)}
        </ul>
      ) : (
        <p className={styles.empty}>No tags yet. Create a tag to organize records in this workspace.</p>
      )}
    </section>
  );
}
