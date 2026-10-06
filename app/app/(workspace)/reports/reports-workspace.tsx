"use client";

import type { ReportData, ReportOwner, ReportPipeline } from "@/lib/reports/repository";
import type { ReportFilters } from "@/lib/reports/schema";
import { buildReportCsv, calculateWinRate } from "@/lib/reports/presentation";

type Props = { report: ReportData; owners: ReportOwner[]; pipelines: ReportPipeline[]; filters: ReportFilters; currency: string };

export function ReportsWorkspace({ report, owners, pipelines, filters, currency }: Props) {
  const currencyFormat = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
  const money = (amount: number) => currencyFormat.format(amount);
  const closedDeals = report.summary.won_count + report.summary.lost_count;
  const winRate = calculateWinRate(report.summary.won_count, report.summary.lost_count);
  const revenueTrend = trendPath(report.revenue_trend.map(({ amount }) => amount));
  const exportRows = [
    ["Report", "Selected period", `${filters.start} to ${filters.end}`],
    ["Owner filter", owners.find(({ id }) => id === filters.ownerId)?.name ?? "All available owners"],
    ["Pipeline filter", pipelines.find(({ id }) => id === filters.pipelineId)?.name ?? "All pipelines"],
    ["KPI", "Value", "Date meaning"],
    ["Won revenue", money(report.summary.won_revenue), "Deals with won_at in selected period"],
    ["Deal value created", money(report.summary.total_deal_value), "Deals with created_at in selected period"],
    ["Deals created", report.summary.total_deals, "created_at in selected period"],
    ["Win rate", winRate, "Won / (won + lost), using won_at and lost_at"],
    ["Average deal value", money(report.summary.average_deal_value), "Deal value created / deals created"],
    ...report.revenue_trend.map((row) => ["Revenue trend", dateFormat.format(new Date(row.month)), money(row.amount)]),
    ...report.pipeline_by_stage.map((row) => ["Current open pipeline", row.name, `${row.deals} deals · ${money(row.amount)}`]),
    ...report.deals_by_source.map((row) => ["Deals by source", row.name, `${row.deals} deals · ${money(row.amount)}`]),
    ...report.activity_by_rep.map((row) => ["Human activity", row.name, row.activities]),
    ...report.top_deals.map((row) => ["Highest-value deal created", row.title, row.company ?? "", row.owner, row.stage ?? "", money(row.amount), row.created_at, row.status]),
  ];

  function exportCsv() {
    const csv = buildReportCsv(exportRows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `nexa-reports-${filters.start}-to-${filters.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="page-container reports-page">
      <header className="reports-header">
        <div><h1 className="page-title">Reports</h1><p className="page-description">Understand sales performance from your workspace records.</p></div>
      </header>
      {filters.invalid && <p className="reports-filter-message" role="status">Some report filters were invalid. Showing a safe date range and available workspace options.</p>}
      <section className="reports-toolbar" aria-label="Report filters">
        <form className="reports-filters" action="/app/reports" method="get">
          <label className="reports-field"><span>Date from</span><input aria-label="Start date" name="start" type="date" defaultValue={filters.start} /></label>
          <label className="reports-field"><span>Date to</span><input aria-label="End date" name="end" type="date" defaultValue={filters.end} /></label>
          <label className="reports-field"><span>Owner</span><select aria-label="Owner" name="owner" defaultValue={filters.ownerId}><option value="all">All available owners</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
          <label className="reports-field"><span>Pipeline</span><select aria-label="Pipeline" name="pipeline" defaultValue={filters.pipelineId}><option value="all">All pipelines</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
          <button className="reports-button reports-apply" type="submit">Update report</button>
        </form>
        <button className="reports-button reports-export" type="button" onClick={exportCsv} aria-label="Export filtered report as CSV">Export CSV</button>
      </section>
      <p className="reports-scope-note">Deals created use creation date; revenue and win/loss use close date; activity uses occurrence date. Revenue includes {currency} records only. Current open pipeline is a snapshot, not date-based.</p>
      <section className="reports-kpis" aria-label="Report summary">
        <article className="reports-kpi"><span>Won revenue / deal value</span><strong>{money(report.summary.won_revenue)} <i>/</i> {money(report.summary.total_deal_value)}</strong><small>Won by close date / created by creation date</small></article>
        <article className="reports-kpi"><span>Total deals</span><strong>{report.summary.total_deals.toLocaleString()}</strong><small>Created during selected period</small></article>
        <article className="reports-kpi"><span>Win rate</span><strong>{winRate}</strong><small>{closedDeals.toLocaleString()} closed deals; open deals excluded</small></article>
        <article className="reports-kpi"><span>Average deal value</span><strong>{money(report.summary.average_deal_value)}</strong><small>Created deal value ÷ deals created</small></article>
      </section>

      <section className="reports-primary-grid" aria-label="Revenue and pipeline charts">
        <article className="reports-panel reports-revenue-panel"><PanelHeading title="Revenue Trend" note="Won revenue by close month · selected period" />
          {report.revenue_trend.length ? <div className="reports-trend-wrap"><svg className="reports-trend" viewBox="0 0 600 180" role="img" aria-label={`Won revenue trend: ${report.revenue_trend.map((item) => `${dateFormat.format(new Date(item.month))}, ${money(item.amount)}`).join("; ")}`}>
            {[0, 1, 2, 3].map((line) => <line key={line} x1="44" x2="590" y1={20 + line * 44} y2={20 + line * 44} className="reports-grid-line" />)}
            {revenueTrend.path && <path d={revenueTrend.path} className="reports-trend-line" />}
            {report.revenue_trend.map((item, index) => { const point = revenueTrend.points[index]; return <g key={item.month}><circle cx={point.x} cy={point.y} r="4" className="reports-trend-dot" /><text x={point.x} y="170" textAnchor="middle" className="reports-axis-label">{dateFormat.format(new Date(item.month))}</text></g>; })}
          </svg><div className="reports-trend-values">{report.revenue_trend.map((item) => <span key={item.month}>{dateFormat.format(new Date(item.month))}: <b>{money(item.amount)}</b> · {item.deals} deals</span>)}</div></div> : <ChartEmpty>No won revenue in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Pipeline by Stage" note="Current open deal value · not date-filtered" />
          {report.pipeline_by_stage.length && report.pipeline_by_stage.some(({ deals }) => deals > 0) ? <BarList items={report.pipeline_by_stage.map((item) => ({ label: item.name, value: item.amount, detail: `${item.deals} deals · ${money(item.amount)}` }))} format={money} /> : <ChartEmpty>No open pipeline records match these filters.</ChartEmpty>}
        </article>
      </section>

      <section className="reports-secondary-grid" aria-label="Additional report charts">
        <article className="reports-panel"><PanelHeading title="Deals by Source" note="Deals created during selected period" />
          {report.deals_by_source.length ? <BarList items={report.deals_by_source.map((item) => ({ label: item.name, value: item.deals, detail: `${item.deals} deals · ${money(item.amount)}` }))} format={(value) => `${value} deals`} /> : <ChartEmpty>No deals were created in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Win/Loss Summary" note="Closed by won_at / lost_at; open deals excluded from rate" />
          {closedDeals ? <><BarList items={[{ label: "Won", value: report.summary.won_count, detail: `${report.summary.won_count} won · ${money(report.summary.won_revenue)}` }, { label: "Lost", value: report.summary.lost_count, detail: `${report.summary.lost_count} lost` }]} format={(value) => `${value} deals`} /><p className="reports-open-note">Current open deals: {report.outcomes.open.toLocaleString()} · not in the win-rate denominator</p></> : <ChartEmpty>No won or lost deals in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Activity by Rep" note={`Human activity by creator · ${filters.pipelineId === "all" ? "occurred_at in selected period" : "linked to selected pipeline deals"}`} />
          {report.activity_by_rep.length ? <BarList items={report.activity_by_rep.map((item) => ({ label: item.name, value: item.activities, detail: `${item.activities} activities` }))} format={(value) => `${value} activities`} /> : <ChartEmpty>No human activity was logged in this period.</ChartEmpty>}
        </article>
      </section>

      <section className="reports-panel reports-table-panel">
        <div className="reports-panel-heading"><div><h2>Highest-value deals created</h2><p>Ranked by deal amount · creation date in selected period · maximum 10 rows</p></div><span className="reports-count">{report.top_deals.length} deals</span></div>
        {report.top_deals.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th scope="col">Deal</th><th scope="col">Company</th><th scope="col">Owner</th><th scope="col">Stage</th><th scope="col">Amount ({currency})</th><th scope="col">Created</th><th scope="col">Status</th></tr></thead><tbody>{report.top_deals.map((deal) => <tr key={deal.id}><td><a href={`/app/deals/${deal.id}`}>{deal.title}</a></td><td>{deal.company || "—"}</td><td>{deal.owner}</td><td>{deal.stage || "—"}</td><td className="reports-amount">{money(deal.amount)}</td><td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(deal.created_at))}</td><td><span className={`reports-status reports-status-${deal.status}`}>{deal.status}</span></td></tr>)}</tbody></table></div> : <ChartEmpty>No deals match the selected creation date, owner, pipeline, and currency.</ChartEmpty>}
      </section>
    </main>
  );
}

function PanelHeading({ title, note }: { title: string; note: string }) {
  return <div className="reports-panel-heading"><div><h2>{title}</h2><p>{note}</p></div></div>;
}
function ChartEmpty({ children }: { children: React.ReactNode }) { return <p className="reports-chart-empty">{children}</p>; }
function BarList({ items, format }: { items: Array<{ label: string; value: number; detail: string }>; format: (value: number) => string }) {
  const max = Math.max(...items.map(({ value }) => value), 1);
  return <ul className="reports-bar-list">{items.map(({ label, value, detail }, index) => <li key={label}><div className="reports-bar-label"><span>{label}</span><strong>{detail}</strong></div><div className="reports-bar-track"><span className={`reports-bar-fill reports-bar-fill-${index % 4}`} style={{ width: `${Math.max(value ? value / max * 100 : 0, value ? 3 : 0)}%` }} /></div><span className="reports-visually-hidden">{format(value)}</span></li>)}</ul>;
}
function trendPath(values: number[]) {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 317 : 48 + index * (534 / (values.length - 1)), y: 152 - value / max * 124 }));
  return { points, path: points.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ") };
}
