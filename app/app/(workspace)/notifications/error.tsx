"use client";

export default function NotificationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container notifications-page"><header className="notifications-header"><div><h1 className="page-title">Notifications</h1><p className="page-description">Workspace updates and alerts.</p></div></header><section className="leads-error" role="alert"><h2>Notifications could not be loaded</h2><p>Something interrupted the request. Try again; no notifications were changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
