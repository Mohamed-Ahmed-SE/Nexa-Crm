import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/auth/validation";
import { getSupabaseEnvironment } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeInternalPath(request.nextUrl.searchParams.get("next"), "/auth/sign-in");
  const environment = getSupabaseEnvironment();
  const supabase = await createSupabaseServerClient();
  if (!environment || !supabase) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  const callbackUrl = (path: string) => new URL(path, environment.siteUrl);
  if (!code) return NextResponse.redirect(callbackUrl("/auth/sign-in?error=callback"));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(callbackUrl("/auth/sign-in?error=callback"));
  return NextResponse.redirect(callbackUrl(destination));
}
