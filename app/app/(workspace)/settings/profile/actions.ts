"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/profiles/schema";

export type ProfileActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };

function formString(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

export async function updateProfileAction(_previous: ProfileActionState, form: FormData): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse({
    fullName: formString(form, "fullName"),
    avatarUrl: formString(form, "avatarUrl"),
    phone: formString(form, "phone"),
    jobTitle: formString(form, "jobTitle"),
    timezone: formString(form, "timezone"),
  });
  if (!parsed.success) {
    return { message: "Check your profile details and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };

  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) return { message: "Sign in to update your profile." };

  const { data: profile, error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    avatar_url: parsed.data.avatarUrl,
    phone: parsed.data.phone,
    job_title: parsed.data.jobTitle,
    timezone: parsed.data.timezone,
  }).eq("id", authResult.user.id).select("id").maybeSingle();
  if (error || !profile) return { message: "Unable to save your profile. Try again." };

  revalidatePath("/app");
  return { ok: true, message: "Profile saved." };
}
