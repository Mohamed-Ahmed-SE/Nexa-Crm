export default function NotificationsLoading() {
  return (
    <main aria-busy="true" className="page-container notifications-page">
      <header className="notifications-header">
        <div><h1 className="page-title">Notifications</h1><p className="page-description">Loading workspace updates…</p></div>
      </header>
      <section aria-label="Notifications" className="notifications-list"><p className="notifications-loading" role="status">Loading notifications…</p></section>
    </main>
  );
}
