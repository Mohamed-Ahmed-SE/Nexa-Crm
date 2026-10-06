"use client";

export default function DealsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-container deals-page"><header className="deals-header"><div><h1 className="page-title">Deals</h1><p className="page-description">Track active work across your sales pipeline.</p></div></header><section className="deals-error" role="alert"><h2>Deals could not be loaded</h2><p>Something interrupted the request. Try again; your workspace records have not been changed.</p><button className="deals-button deals-button-secondary" onClick={reset} type="button">Try again</button></section></div>;
}
