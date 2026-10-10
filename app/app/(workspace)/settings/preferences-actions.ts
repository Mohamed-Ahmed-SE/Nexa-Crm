"use server";

import { revalidatePath } from "next/cache";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { dateFormatSchema } from "@/lib/preferences/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PreferenceActionState = { ok?: boolean; message?: string };

export async function updateDateFormatAction(_previous: PreferenceActionState, form: FormData): Promise<PreferenceActionState> {
  const parsed = dateFormatSchema.safeParse(form.get("dateFormat"));
  if (!parsed.success) return { message: "Choose one of the supported date formats." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  throwIfAuthVerificationFailed(authError);
  if (!authResult.user) return { message: "Sign in to update your preferences." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ date_format: parsed.data })
    .eq("id", authResult.user.id)
    .select("id")
    .maybeSingle();
  if (error || !profile) return { message: "Unable to save your date format. Try again." };

  revalidatePath("/app");
  return { ok: true, message: "Date format saved." };
}
