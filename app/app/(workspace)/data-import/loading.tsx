export default function ImportLoading() {
  return <main aria-busy="true" aria-label="Loading import" className="page-container leads-page csv-import-page">
    <header className="leads-header"><div><h1 className="page-title">Import CSV</h1><p className="page-description">Loading import tools…</p></div></header>
    <div aria-hidden="true" className="leads-loading-panel"><span /><span /><span /><span /></div>
  </main>;
}
