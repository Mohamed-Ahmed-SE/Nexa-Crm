export default function LeadsLoading() {
  return <main aria-busy="true" aria-label="Loading leads" className="page-container leads-page">
    <header className="leads-header"><div><h1 className="page-title">Leads</h1><p className="page-description">Loading workspace leads…</p></div></header>
    <div aria-hidden="true" className="leads-summary leads-loading-summary"><span /><span /><span /></div>
    <div aria-hidden="true" className="leads-loading-panel"><span /><span /><span /><span /><span /></div>
  </main>;
}
