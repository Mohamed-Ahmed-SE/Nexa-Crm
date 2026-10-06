"use client";

export default function TasksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container tasks-page"><header className="tasks-header"><div><h1 className="page-title">Tasks</h1><p className="page-description">Keep follow-ups and sales activities organized.</p></div></header><section className="tasks-error" role="alert"><h2>Tasks could not be loaded</h2><p>Workspace task data is temporarily unavailable. Try again; no task changes were made.</p><button className="tasks-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
