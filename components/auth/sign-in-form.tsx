"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/validation";
import { PasswordField } from "@/components/auth/password-field";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, action, isPending] = useActionState(signInAction, initialFormState);
  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={nextPath} />
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input autoComplete="email" id="email" name="email" required type="email" />
      </div>
      <PasswordField autoComplete="current-password" id="password" label="Password" name="password" />
      <div className="auth-link-row"><Link href="/auth/forgot-password">Forgot password?</Link></div>
      {state.message ? <p aria-live="polite" className="auth-message" role="status">{state.message}</p> : null}
      <button className="auth-submit" disabled={isPending} type="submit">
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
