import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { getWorkspaceContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const supabase = await createSupabaseServerClient();
  const { data: authResult, error } = await supabase!.auth.getUser();
  if (error) throw new Error("Unable to verify the current session.");
  if (!authResult.user) redirect("/auth/sign-in?next=/onboarding");
  if (await getWorkspaceContext()) redirect("/app/dashboard");

  return (
    <AuthCard description="Set up the shared space for your team. You can configure the rest later." title="Create your workspace">
      <div aria-label="Onboarding progress" className="onboarding-progress">
        <span aria-current="step" className="progress-step progress-step-active">Workspace details</span>
        <span className="progress-divider" />
        <span className="progress-step">Your role</span>
        <span className="progress-divider" />
        <span className="progress-step">Done</span>
      </div>
      <OnboardingForm />
    </AuthCard>
  );
}
