"use client";

import Link from "next/link";

export default function CompanyDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="dashboard-page companies-page"><Link className="contact-breadcrumb" href="/app/companies">Companies</Link><section className="leads-error" role="alert"><h2>Company could not be loaded</h2><p>Check your connection and try again. No workspace records were changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
