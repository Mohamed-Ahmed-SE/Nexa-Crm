"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/validation";

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(forgotPasswordAction, initialFormState);
  return (
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input autoComplete="email" id="email" name="email" required type="email" />
      </div>
      {state.message ? <p aria-live="polite" className={state.success ? "auth-message auth-success" : "auth-message"} role="status">{state.message}</p> : null}
      <button className="auth-submit" disabled={isPending} type="submit">{isPending ? "Sending…" : "Send reset link"}</button>
      <p className="auth-secondary-link"><Link href="/auth/sign-in">Back to sign in</Link></p>
    </form>
  );
}
