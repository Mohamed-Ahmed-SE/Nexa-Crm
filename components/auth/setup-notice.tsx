import Link from "next/link";

export function SetupNotice() {
  return (
    <main className="auth-page">
      <div className="auth-brand"><span aria-hidden="true" className="brand-mark">N</span><span className="brand-name">Nexa CRM</span></div>
      <section aria-labelledby="setup-title" className="auth-card">
        <h1 id="setup-title">Supabase setup required</h1>
        <p className="auth-description">Authentication is disabled until this project is connected to Supabase. Add the public project URL, anon key, and site URL to your local environment, then restart the app.</p>
        <p className="setup-code"><code>NEXT_PUBLIC_SUPABASE_URL</code><br /><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code><br /><code>NEXT_PUBLIC_SITE_URL</code></p>
        <p className="auth-description">See <code>SUPABASE_SETUP.md</code> in the project root for setup steps. Protected workspace routes remain unavailable.</p>
        <Link className="auth-secondary-link" href="/auth/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
