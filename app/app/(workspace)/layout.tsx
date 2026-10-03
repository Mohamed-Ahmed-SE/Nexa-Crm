import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SetupNotice } from "@/components/auth/setup-notice";
import { getWorkspaceContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const context = await getWorkspaceContext();
  if (!context) {
    const supabase = await createSupabaseServerClient();
    const { data: authResult, error } = await supabase!.auth.getUser();
    if (error) throw new Error("Unable to verify the current session.");
    redirect(authResult.user ? "/onboarding" : "/auth/sign-in");
  }

  return <AppShell context={context}>{children}</AppShell>;
}
