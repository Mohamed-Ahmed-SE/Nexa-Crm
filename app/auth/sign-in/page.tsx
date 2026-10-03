import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeInternalPath } from "@/lib/auth/validation";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const supabase = await createSupabaseServerClient();
  const { data: authResult, error } = await supabase!.auth.getUser();
  throwIfAuthVerificationFailed(error);
  if (authResult.user) redirect("/app/dashboard");

  const params = await searchParams;
  return (
    <AuthCard description="Sign in to continue to your workspace." title="Welcome back">
      {params.error ? <p className="auth-message" role="alert">That sign-in link is invalid or has expired. Request a new password reset.</p> : null}
      <SignInForm nextPath={safeInternalPath(params.next ?? null)} />
    </AuthCard>
  );
}
