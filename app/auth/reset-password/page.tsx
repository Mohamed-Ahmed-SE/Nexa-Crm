import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const supabase = await createSupabaseServerClient();
  const { data: authResult, error } = await supabase!.auth.getUser();
  throwIfAuthVerificationFailed(error);
  if (!authResult.user) redirect("/auth/forgot-password");

  return (
    <AuthCard description="Choose a new password with at least 12 characters." title="Create a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
