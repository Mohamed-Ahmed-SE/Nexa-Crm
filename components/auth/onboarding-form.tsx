"use client";

import { useActionState } from "react";
import { createWorkspaceAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/validation";

export function OnboardingForm() {
  const [state, action, isPending] = useActionState(createWorkspaceAction, initialFormState);
  return (
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="workspaceName">Workspace name <span aria-hidden="true">*</span></label>
        <input autoComplete="organization" id="workspaceName" maxLength={80} minLength={2} name="workspaceName" required />
        <span className="auth-hint">Use your company or team name.</span>
      </div>
      <div className="auth-field">
        <label htmlFor="jobTitle">Your role or job title <span className="optional-label">Optional</span></label>
        <input autoComplete="organization-title" id="jobTitle" maxLength={100} name="jobTitle" />
      </div>
      {state.message ? <p aria-live="polite" className="auth-message" role="status">{state.message}</p> : null}
      <button className="auth-submit" disabled={isPending} type="submit">{isPending ? "Creating workspace…" : "Create workspace"}</button>
      <p className="auth-hint">Pipeline setup, data import, and teammate invites can be added later.</p>
    </form>
  );
}
