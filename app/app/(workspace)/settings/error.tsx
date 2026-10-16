"use client";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container"><header className="page-header"><div><h1 className="page-title">Settings</h1><p className="page-description">Workspace and account configuration.</p></div></header><section className="leads-error" role="alert"><h2>Settings could not be loaded</h2><p>Something interrupted the request. Try again; your workspace settings have not been changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
