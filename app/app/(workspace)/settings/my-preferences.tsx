"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCalendarDate, type DateFormat } from "@/lib/preferences/date-format";
import { updateDateFormatAction, type PreferenceActionState } from "./preferences-actions";
import styles from "./my-preferences.module.css";

const initialState: PreferenceActionState = {};
const exampleDate = "2026-04-05";

export function MyPreferences({ dateFormat }: { dateFormat: DateFormat }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateDateFormatAction, initialState);
  const [selectedFormat, setSelectedFormat] = useState(dateFormat);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <section aria-labelledby="my-preferences-title" className={styles.section}>
      <h2 id="my-preferences-title">My preferences</h2>
      <form action={formAction} className={styles.form}>
        <label className={styles.field} htmlFor="date-format">
          <span>Date format</span>
          <select aria-describedby="date-format-example" disabled={pending} id="date-format" name="dateFormat" onChange={(event) => setSelectedFormat(event.target.value as DateFormat)} value={selectedFormat}>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </label>
        <p className={styles.example} id="date-format-example">Example: {formatCalendarDate(exampleDate, selectedFormat)}</p>
        <button className={styles.button} disabled={pending} type="submit">
          {pending ? "Saving…" : "Save preference"}
        </button>
      </form>
      {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    </section>
  );
}
