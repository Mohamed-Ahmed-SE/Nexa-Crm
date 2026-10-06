export default function ReportsLoading() {
  return <main className="page-container reports-page" aria-busy="true" aria-label="Loading reports"><header className="reports-header"><div><h1 className="page-title">Reports</h1><p className="page-description">Loading workspace analytics…</p></div></header><div className="reports-loading" role="status">Loading reports from your workspace…</div></main>;
}
