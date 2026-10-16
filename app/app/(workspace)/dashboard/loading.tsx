import styles from "./dashboard-workspace.module.css";

export default function DashboardLoading() {
  return <main aria-busy="true" aria-label="Loading dashboard" className={styles.page}>
    <header className={styles.header}><div><h1>Sales Dashboard</h1><p>Loading workspace activity…</p></div></header>
    <div aria-hidden="true" className="leads-loading-panel"><span /><span /><span /><span /></div>
  </main>;
}
