import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getWorkspaceContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) throw new Error("Workspace context is unavailable.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <div className="page-container">
        <PageHeader description="Manage your personal details and timezone." title="Profile settings" />
        <EmptyState description="Profile settings are temporarily unavailable. Check the connection and try again." title="Unable to load your profile" />
      </div>
    );
  }

  const { data: profile, error } = await supabase.from("profiles")
    .select("full_name, avatar_url, phone, job_title, timezone")
    .eq("id", context.userId)
    .maybeSingle();

  return (
    <div className="page-container">
      <PageHeader description="Manage your personal details and timezone." title="Profile settings" />
      {error ? (
        <EmptyState description="Your profile could not be loaded. Try again in a moment." title="Unable to load your profile" />
      ) : (
        <ProfileForm profile={{
          fullName: profile?.full_name?.trim() || context.fullName,
          avatarUrl: profile?.avatar_url ?? null,
          phone: profile?.phone ?? null,
          jobTitle: profile?.job_title ?? null,
          timezone: profile?.timezone ?? "UTC",
        }} />
      )}
    </div>
  );
}
