"use client";

import Link from "next/link";

export default function LeadDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container leads-page contact-detail-page"><header className="leads-header"><div><h1 className="page-title">Lead</h1><p className="page-description">Lead details are temporarily unavailable.</p></div></header><section className="leads-error" role="alert"><h2>Lead could not be loaded</h2><p>Check your connection and try again. No workspace records were changed.</p><Link href="/app/leads">Return to Leads</Link><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
