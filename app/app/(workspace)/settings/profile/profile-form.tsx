"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction, type ProfileActionState } from "./actions";
import styles from "../workspace/workspace-settings.module.css";

export type ProfileFormValues = {
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  timezone: string;
};

const initialState: ProfileActionState = {};

export function ProfileForm({ profile }: { profile: ProfileFormValues }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const fieldError = (field: keyof ProfileFormValues) => state.fieldErrors?.[field]?.[0];
  const errors = {
    fullName: fieldError("fullName"),
    avatarUrl: fieldError("avatarUrl"),
    phone: fieldError("phone"),
    jobTitle: fieldError("jobTitle"),
    timezone: fieldError("timezone"),
  };

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field} htmlFor="profile-name">
        <span>Name</span>
        <input aria-describedby={errors.fullName ? "profile-name-error" : undefined} aria-invalid={Boolean(errors.fullName)} autoComplete="name" disabled={pending} id="profile-name" maxLength={100} name="fullName" required defaultValue={profile.fullName} />
        {errors.fullName && <small className={styles.error} id="profile-name-error">{errors.fullName}</small>}
      </label>
      <label className={styles.field} htmlFor="profile-avatar-url">
        <span>Avatar URL <small>(optional)</small></span>
        <input aria-describedby={errors.avatarUrl ? "profile-avatar-url-error" : "profile-avatar-url-help"} aria-invalid={Boolean(errors.avatarUrl)} autoCapitalize="none" disabled={pending} id="profile-avatar-url" maxLength={2048} name="avatarUrl" type="url" defaultValue={profile.avatarUrl ?? ""} />
        <small className={errors.avatarUrl ? styles.error : styles.help} id={errors.avatarUrl ? "profile-avatar-url-error" : "profile-avatar-url-help"}>{errors.avatarUrl ?? "Enter an HTTPS image URL, or leave blank to use your initials."}</small>
      </label>
      <label className={styles.field} htmlFor="profile-phone">
        <span>Phone <small>(optional)</small></span>
        <input aria-describedby={errors.phone ? "profile-phone-error" : undefined} aria-invalid={Boolean(errors.phone)} autoComplete="tel" disabled={pending} id="profile-phone" maxLength={50} name="phone" type="tel" defaultValue={profile.phone ?? ""} />
        {errors.phone && <small className={styles.error} id="profile-phone-error">{errors.phone}</small>}
      </label>
      <label className={styles.field} htmlFor="profile-job-title">
        <span>Job title <small>(optional)</small></span>
        <input aria-describedby={errors.jobTitle ? "profile-job-title-error" : undefined} aria-invalid={Boolean(errors.jobTitle)} autoComplete="organization-title" disabled={pending} id="profile-job-title" maxLength={100} name="jobTitle" defaultValue={profile.jobTitle ?? ""} />
        {errors.jobTitle && <small className={styles.error} id="profile-job-title-error">{errors.jobTitle}</small>}
      </label>
      <label className={styles.field} htmlFor="profile-timezone">
        <span>Timezone</span>
        <input aria-describedby={errors.timezone ? "profile-timezone-error" : "profile-timezone-help"} aria-invalid={Boolean(errors.timezone)} autoCapitalize="none" disabled={pending} id="profile-timezone" maxLength={100} name="timezone" required defaultValue={profile.timezone} />
        <small className={errors.timezone ? styles.error : styles.help} id={errors.timezone ? "profile-timezone-error" : "profile-timezone-help"}>{errors.timezone ?? "Enter an IANA timezone, such as America/New_York. This does not change how dates are shown in the app."}</small>
      </label>
      <button className={styles.button} disabled={pending} type="submit">{pending ? "Saving…" : "Save profile"}</button>
      {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
