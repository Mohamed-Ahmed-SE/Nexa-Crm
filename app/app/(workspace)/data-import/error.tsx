"use client";

export default function ImportError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container leads-page csv-import-page"><header className="leads-header"><div><h1 className="page-title">Import CSV</h1><p className="page-description">Create new workspace records from a CSV file. Existing records are never changed.</p></div></header><section className="leads-error" role="alert"><h2>Import could not be loaded</h2><p>Something interrupted the request. Try again; no records were imported.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
