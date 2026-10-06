export default function DealsLoading() {
  return <div aria-busy="true" aria-label="Loading deals" className="page-container deals-page">
    <header className="deals-header"><div><h1 className="page-title">Deals</h1><p className="page-description">Loading your workspace pipeline…</p></div></header>
    <div aria-hidden="true" className="deals-skeleton"><span /><span /><span /><span /></div>
  </div>;
}
