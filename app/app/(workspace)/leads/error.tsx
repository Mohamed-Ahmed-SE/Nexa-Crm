"use client";

export default function LeadsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container leads-page"><header className="leads-header"><div><h1 className="page-title">Leads</h1><p className="page-description">Track, qualify, and manage prospective customers in this workspace.</p></div></header><section className="leads-error" role="alert"><h2>Leads could not be loaded</h2><p>Something interrupted the request. Try again; your workspace records have not been changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
