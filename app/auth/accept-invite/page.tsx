import Link from "next/link";
import { AcceptWorkspaceInvite } from "@/components/auth/workspace-access-manager";
import { AuthCard } from "@/components/auth/auth-card";
import { SetupNotice } from "@/components/auth/setup-notice";
import { isValidInviteToken } from "@/lib/auth/invite-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Accept workspace invitation | Nexa CRM",
  referrer: "no-referrer" as const,
};

export default async function AcceptInvitePage({ searchParams }: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const token = (await searchParams).token ?? "";
  if (!isValidInviteToken(token)) {
    return (
      <AuthCard description="Invitation links are single-use. Ask a workspace administrator to create a new link." title="Invalid invitation link">
        <Link className="auth-secondary-link" href="/auth/sign-in">Return to sign in</Link>
      </AuthCard>
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <SetupNotice />;
  const { data: authResult, error } = await supabase.auth.getUser();
  if (error) throw new Error("Unable to verify the current session.");

  if (!authResult.user) {
    const nextPath = `/auth/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <AuthCard description="Sign in with the email address that received this invitation, then accept the link." title="You’re invited">
        <div className="auth-form">
          <p className="auth-hint">Invitation links expire and can be accepted once. They are not sent by email from Nexa CRM.</p>
          <Link className="auth-submit auth-submit-link" href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}>Sign in to continue</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard description="Confirm your account to join the workspace." title="Accept invitation">
      <AcceptWorkspaceInvite token={token} signedInEmail={authResult.user.email ?? undefined} />
    </AuthCard>
  );
}
