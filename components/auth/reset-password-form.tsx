"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/validation";
import { PasswordField } from "@/components/auth/password-field";

export function ResetPasswordForm() {
  const [state, action, isPending] = useActionState(resetPasswordAction, initialFormState);
  return (
    <form action={action} className="auth-form">
      <PasswordField autoComplete="new-password" id="password" label="New password" minLength={12} name="password" />
      <PasswordField autoComplete="new-password" id="confirmPassword" label="Confirm new password" minLength={12} name="confirmPassword" />
      {state.message ? <p aria-live="polite" className="auth-message" role="status">{state.message}</p> : null}
      <button className="auth-submit" disabled={isPending} type="submit">{isPending ? "Updating…" : "Update password"}</button>
      <p className="auth-secondary-link"><Link href="/auth/forgot-password">Request another reset link</Link></p>
    </form>
  );
}
