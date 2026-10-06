export default function TasksLoading() {
  return <main aria-busy="true" className="page-container tasks-page"><header className="tasks-header"><div><h1 className="page-title">Tasks</h1><p className="page-description">Loading workspace tasks…</p></div></header><div aria-hidden="true" className="tasks-loading"><span /><span /><span /></div></main>;
}
