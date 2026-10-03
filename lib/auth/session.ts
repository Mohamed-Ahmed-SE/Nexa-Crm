import { isAuthSessionMissingError } from "@supabase/supabase-js";

export function throwIfAuthVerificationFailed(error: unknown): void {
  if (error && !isAuthSessionMissingError(error)) {
    throw new Error("Unable to verify the current session.");
  }
}
