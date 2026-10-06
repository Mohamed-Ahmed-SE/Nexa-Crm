"use client";

import Link from "next/link";

export default function DealDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-container deals-page deal-detail-page"><nav aria-label="Breadcrumb" className="deal-detail-breadcrumb"><Link href="/app/deals">Deals</Link><span aria-hidden="true">/</span><span>Deal</span></nav><section className="leads-error" role="alert"><h1>Deal details could not be loaded</h1><p>Workspace deal data is temporarily unavailable. Try again, or return to the Deals list.</p><div className="deal-detail-error-actions"><Link className="deals-button deals-button-secondary" href="/app/deals">Return to Deals</Link><button className="deals-button deals-button-primary" onClick={reset} type="button">Try again</button></div></section></div>;
}
