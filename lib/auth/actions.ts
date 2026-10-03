"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createWorkspaceSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  safeInternalPath,
  signInSchema,
  type FormState,
} from "@/lib/auth/validation";

function formText(formData: FormData, field: string): string {
  const entry = formData.get(field);
  return typeof entry === "string" ? entry : "";
}

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = signInSchema.safeParse({ email: formText(formData, "email"), password: formText(formData, "password") });
  if (!fields.success) return { message: "Enter a valid email and password." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured. Ask your administrator to complete Supabase setup." };
  const { error } = await supabase.auth.signInWithPassword(fields.data);
  if (error) return { message: "We couldn’t sign you in with those details." };

  redirect(safeInternalPath(formText(formData, "next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Unable to sign out. Please try again.");
  }
  redirect("/auth/sign-in");
}

export async function forgotPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = forgotPasswordSchema.safeParse({ email: formText(formData, "email") });
  if (!fields.success) return { message: "Enter a valid email address." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured. Ask your administrator to complete Supabase setup." };
  const { error } = await supabase.auth.resetPasswordForEmail(fields.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"}/auth/callback?next=/auth/reset-password`,
  });
  if (error) return { message: "Password reset could not be requested. Please try again." };
  return { success: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = resetPasswordSchema.safeParse({
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!fields.success) return { message: fields.error.issues[0]?.message ?? "Check your password and try again." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured. Ask your administrator to complete Supabase setup." };
  const { error } = await supabase.auth.updateUser({ password: fields.data.password });
  if (error) return { message: "The reset link is invalid or expired. Request a new one." };
  redirect("/app/dashboard");
}

export async function createWorkspaceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = createWorkspaceSchema.safeParse({
    name: formText(formData, "workspaceName"),
    jobTitle: formText(formData, "jobTitle"),
  });
  if (!fields.success) return { message: fields.error.issues[0]?.message ?? "Check the workspace details." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured. Ask your administrator to complete Supabase setup." };
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) return { message: "Sign in before creating a workspace." };

  const { error } = await supabase.rpc("create_first_workspace", {
    workspace_name: fields.data.name,
    member_job_title: fields.data.jobTitle || null,
  });
  if (error) return { message: "Workspace setup could not be completed. Try again or contact your administrator." };
  redirect("/app/dashboard");
}
