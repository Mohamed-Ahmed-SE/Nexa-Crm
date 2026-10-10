"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspaceSettingsAction, type WorkspaceSettingsActionState } from "./actions";
import styles from "./workspace-settings.module.css";

export type WorkspaceSettingsFormValues = {
  name: string;
  logoUrl: string | null;
  defaultCurrency: string;
  timezone: string;
};

const initialState: WorkspaceSettingsActionState = {};

export function WorkspaceSettingsForm({ settings }: { settings: WorkspaceSettingsFormValues }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateWorkspaceSettingsAction, initialState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  const fieldError = (field: keyof WorkspaceSettingsFormValues) => state.fieldErrors?.[field]?.[0];
  const nameError = fieldError("name");
  const logoError = fieldError("logoUrl");
  const currencyError = fieldError("defaultCurrency");
  const timezoneError = fieldError("timezone");

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field} htmlFor="workspace-name">
        <span>Workspace name</span>
        <input aria-describedby={nameError ? "workspace-name-error" : undefined} aria-invalid={Boolean(nameError)} autoComplete="organization" disabled={pending} id="workspace-name" name="name" required defaultValue={settings.name} />
        {nameError && <small className={styles.error} id="workspace-name-error">{nameError}</small>}
      </label>
      <label className={styles.field} htmlFor="workspace-logo-url">
        <span>Logo URL <small>(optional)</small></span>
        <input aria-describedby={logoError ? "workspace-logo-url-error" : "workspace-logo-help"} aria-invalid={Boolean(logoError)} disabled={pending} id="workspace-logo-url" maxLength={2048} name="logoUrl" type="url" defaultValue={settings.logoUrl ?? ""} />
        <small className={logoError ? styles.error : styles.help} id={logoError ? "workspace-logo-url-error" : "workspace-logo-help"}>{logoError ?? "Enter an HTTPS URL, or leave blank to remove the workspace logo."}</small>
      </label>
      <label className={styles.field} htmlFor="workspace-currency">
        <span>Default currency</span>
        <input aria-describedby={currencyError ? "workspace-currency-error" : "workspace-currency-help"} aria-invalid={Boolean(currencyError)} autoCapitalize="characters" disabled={pending} id="workspace-currency" maxLength={3} minLength={3} name="defaultCurrency" required defaultValue={settings.defaultCurrency} />
        <small className={currencyError ? styles.error : styles.help} id={currencyError ? "workspace-currency-error" : "workspace-currency-help"}>{currencyError ?? "Use a supported three-letter currency code, such as USD."}</small>
      </label>
      <label className={styles.field} htmlFor="workspace-timezone">
        <span>Timezone</span>
        <input aria-describedby={timezoneError ? "workspace-timezone-error" : "workspace-timezone-help"} aria-invalid={Boolean(timezoneError)} autoCapitalize="none" disabled={pending} id="workspace-timezone" maxLength={100} name="timezone" required defaultValue={settings.timezone} />
        <small className={timezoneError ? styles.error : styles.help} id={timezoneError ? "workspace-timezone-error" : "workspace-timezone-help"}>{timezoneError ?? "Enter an IANA timezone, such as America/New_York."}</small>
      </label>
      <button className={styles.button} disabled={pending} type="submit">{pending ? "Saving…" : "Save workspace settings"}</button>
      {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
