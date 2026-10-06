"use client";

export default function ContactsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-container leads-page contacts-page"><header className="leads-header"><div><h1 className="page-title">Contacts</h1><p className="page-description">Keep customer and prospect relationships clear and actionable.</p></div></header><section className="leads-error" role="alert"><h2>Contacts could not be loaded</h2><p>Check your connection and try again. Your workspace records have not been changed.</p><button className="leads-secondary-button" onClick={reset} type="button">Try again</button></section></main>;
}
