export type SupabaseEnvironment = {
  url: string;
  anonKey: string;
  siteUrl: string;
};

function isSecureOrigin(value: string): URL | null {
  try {
    const parsedUrl = new URL(value);
    const isLocalhost = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    if ((parsedUrl.protocol !== "https:" && !isLocalhost) || parsedUrl.username || parsedUrl.password) return null;
    return parsedUrl;
  } catch {
    return null;
  }
}

export function getSupabaseEnvironment(): SupabaseEnvironment | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!url || !anonKey || !siteUrl) return null;

  const projectOrigin = isSecureOrigin(url);
  const siteOrigin = isSecureOrigin(siteUrl);
  if (!projectOrigin || !siteOrigin) return null;
  if (projectOrigin.pathname !== "/" || projectOrigin.search || projectOrigin.hash) return null;
  if (siteOrigin.pathname !== "/" || siteOrigin.search || siteOrigin.hash) return null;
  return { url: projectOrigin.origin, anonKey, siteUrl: siteOrigin.origin };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnvironment() !== null;
}
