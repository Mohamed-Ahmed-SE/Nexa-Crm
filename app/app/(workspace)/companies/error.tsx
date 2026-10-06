"use client";

export default function CompaniesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="dashboard-page companies-page"><section className="leads-error" role="alert"><h1>Companies could not load</h1><p>Workspace company data is temporarily unavailable. Try again.</p><button className="leads-secondary-button" onClick={reset} type="button">Retry</button></section></main>;
}
