export default function DealDetailLoading() {
  return <div aria-busy="true" aria-label="Loading deal details" className="page-container deals-page deal-detail-page"><nav aria-label="Breadcrumb" className="deal-detail-breadcrumb"><span>Deals</span><span aria-hidden="true">/</span><span>Deal</span></nav><header className="deal-detail-header"><div><h1 className="page-title">Deal</h1><p className="page-description">Loading deal details…</p></div></header><section aria-hidden="true" className="deal-detail-loading"><span /><span /><span /></section></div>;
}
