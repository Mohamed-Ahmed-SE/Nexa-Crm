"use client";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container"><section className="leads-error" role="alert"><h2>Something went wrong</h2><p>This page could not be loaded. Try again; your workspace records have not been changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
