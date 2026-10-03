import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <AuthCard description="We’ll email you a link to choose a new password." title="Reset your password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
