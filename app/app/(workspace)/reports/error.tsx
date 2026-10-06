"use client";

export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container reports-page"><header className="reports-header"><div><h1 className="page-title">Reports</h1><p className="page-description">Understand sales performance from your workspace records.</p></div></header><section className="reports-error" role="alert"><h2>Reports could not be loaded</h2><p>Check your connection, then try loading the report again.</p><button className="reports-button" type="button" onClick={reset}>Try again</button></section></main>;
}
