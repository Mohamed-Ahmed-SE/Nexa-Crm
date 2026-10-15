"use client";

import type { ReportData, ReportOwner, ReportPipeline } from "@/lib/reports/repository";
import type { ReportFilters } from "@/lib/reports/schema";
import { buildReportCsv, calculateWinRate } from "@/lib/reports/presentation";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate } from "@/lib/preferences/date-format";

type Props = { report: ReportData; owners: ReportOwner[]; pipelines: ReportPipeline[]; filters: ReportFilters; currency: string };

export function ReportsWorkspace({ report, owners, pipelines, filters, currency }: Props) {
  const preferredDateFormat = useDateFormat();
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
    ["Won deals", report.summary.won_count, "Deals with won_at in selected period"],
    ["Lost deals", report.summary.lost_count, "Deals with lost_at in selected period"],
    ["Open deals", report.outcomes.open, "Current snapshot; owner and pipeline filters apply; not date-based"],
    ...report.revenue_trend.map((row) => ["Revenue trend", dateFormat.format(new Date(row.month)), money(row.amount)]),
    ...report.pipeline_by_stage.map((row) => ["Current open pipeline by stage", formatStageName(row.pipeline, row.name), `${row.deals} deals · ${money(row.amount)}`, "Default-currency open deals; current snapshot; not date-based"]),
    ...report.pipeline_by_owner.map((row) => ["Current open pipeline by owner", row.owner, `${row.deals} deals · ${money(row.amount)}`, "Default-currency open deals; owner and pipeline filters apply; current snapshot, not date-based"]),
    ...report.deals_by_source.map((row) => ["Deals by source", row.name, `${row.deals} deals · ${money(row.amount)}`, "Deals created in selected period"]),
    ...report.lead_source_performance.map((row) => ["Lead source performance", row.name, `${row.leads} leads`, money(row.estimated_value), "Default-currency leads created in selected period; owner filter applies; pipeline does not apply"]),
    ["Tasks completed", report.tasks.completed, "completed_at in selected period; assignee owner filter; pipeline applies only to tasks linked to matching deals"],
    ["Tasks overdue", report.tasks.overdue, "Open tasks due before now; current snapshot; assignee owner filter; pipeline applies only to tasks linked to matching deals"],
    ...report.deal_conversion_funnel.map((row) => ["Tracked deal stage entries", formatStageName(row.pipeline, row.name), `${row.deals} ${row.deals === 1 ? "deal" : "deals"} entered`, "Distinct deals with structured stage-entry events during the selected period; unrecorded history is unavailable"]),
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
      <p className="reports-scope-note">Deals created use creation date; revenue and win/loss use close date; activity uses occurrence date. Revenue includes {currency} records only. Current open pipeline and overdue tasks are snapshots, not date-based. Lead source uses lead creation date; pipeline does not apply to leads. Tasks use completion date for completed counts; a pipeline filter includes only tasks linked to deals in that pipeline. Stage entries include tracked structured events only; events without stage metadata and earlier unrecorded history are unavailable.</p>
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
          {report.pipeline_by_stage.length && report.pipeline_by_stage.some(({ deals }) => deals > 0) ? <BarList items={report.pipeline_by_stage.map((item) => ({ key: `${item.pipeline_id}:${item.stage_id}`, label: formatStageName(item.pipeline, item.name), value: item.amount, detail: `${item.deals} deals · ${money(item.amount)}` }))} format={money} /> : <ChartEmpty>No open pipeline records match these filters.</ChartEmpty>}
        </article>
      </section>

      <section className="reports-secondary-grid" aria-label="Additional report charts">
        <article className="reports-panel"><PanelHeading title="Pipeline Value by Owner" note="Current open default-currency deal snapshot · selected owner and pipeline · not date-filtered" />
          {report.pipeline_by_owner.length ? <BarList items={report.pipeline_by_owner.map((row) => ({ key: row.owner_id ?? "unassigned", label: row.owner, value: row.amount, detail: `${row.deals} deals · ${money(row.amount)}` }))} format={money} /> : <ChartEmpty>No open pipeline records match these filters.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Deals by Source" note="Deals created during selected period" />
          {report.deals_by_source.length ? <BarList items={report.deals_by_source.map((item) => ({ key: item.source_id ?? "unspecified", label: item.name, value: item.deals, detail: `${item.deals} deals · ${money(item.amount)}` }))} format={(value) => `${value} deals`} /> : <ChartEmpty>No deals were created in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Win/Loss Summary" note="Closed by won_at / lost_at; open deals excluded from rate" />
          {closedDeals ? <><BarList items={[{ key: "won", label: "Won", value: report.summary.won_count, detail: `${report.summary.won_count} won · ${money(report.summary.won_revenue)}` }, { key: "lost", label: "Lost", value: report.summary.lost_count, detail: `${report.summary.lost_count} lost` }]} format={(value) => `${value} deals`} /><p className="reports-open-note">Current open deals: {report.outcomes.open.toLocaleString()} · not in the win-rate denominator</p></> : <ChartEmpty>No won or lost deals in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Activity by Rep" note={`Human activity by creator · ${filters.pipelineId === "all" ? "occurred_at in selected period" : "linked to selected pipeline deals"}`} />
          {report.activity_by_rep.length ? <BarList items={report.activity_by_rep.map((item) => ({ key: item.owner_id ?? "unknown-owner", label: item.name, value: item.activities, detail: `${item.activities} activities` }))} format={(value) => `${value} activities`} /> : <ChartEmpty>No human activity was logged in this period.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Lead Source Performance" note={`Leads created in selected period · ${currency} estimated value · pipeline filter does not apply`} />
          {report.lead_source_performance.length ? <BarList items={report.lead_source_performance.map((row) => ({ key: row.source_id ?? "unspecified", label: row.name, value: row.leads, detail: `${row.leads} leads · ${money(row.estimated_value)}` }))} format={(value) => `${value} leads`} /> : <ChartEmpty>No leads were created in this period for the selected owner and currency.</ChartEmpty>}
        </article>
        <article className="reports-panel"><PanelHeading title="Tasks Completed vs Overdue" note="Completed by completed_at in selected period · overdue open tasks as of now" />
          {report.tasks.completed || report.tasks.overdue ? <BarList items={[{ key: "completed", label: "Completed", value: report.tasks.completed, detail: `${report.tasks.completed} completed` }, { key: "overdue", label: "Overdue", value: report.tasks.overdue, detail: `${report.tasks.overdue} overdue` }]} format={(value) => `${value} tasks`} /> : <ChartEmpty>No completed or overdue tasks match these filters.</ChartEmpty>}
          <p className="reports-open-note">Owner filters use assignee. Pipeline filters include only tasks linked to a deal in the selected pipeline; overdue count is not date-filtered.</p>
        </article>
        <article className="reports-panel"><PanelHeading title="Deal Conversion Funnel" note="Distinct deals entering each stage · selected period" />
          {report.deal_conversion_funnel.length && report.deal_conversion_funnel.some(({ deals }) => deals > 0) ? <BarList items={report.deal_conversion_funnel.map((row) => ({ key: `${row.pipeline_id}:${row.stage_id}`, label: formatStageName(row.pipeline, row.name), value: row.deals, detail: `${row.deals} ${row.deals === 1 ? "deal" : "deals"} entered` }))} format={(value) => `${value} deals`} /> : <ChartEmpty>No tracked stage entries match these filters. Events without structured stage metadata and earlier unrecorded history are unavailable.</ChartEmpty>}
          <p className="reports-open-note">Counts include distinct deals with structured stage-entry events inside the selected period; stage entries without metadata and earlier unrecorded events cannot be counted.</p>
        </article>
      </section>

      <section className="reports-panel reports-table-panel">
        <div className="reports-panel-heading"><div><h2>Highest-value deals created</h2><p>Ranked by deal amount · creation date in selected period · maximum 10 rows</p></div><span className="reports-count">{report.top_deals.length} deals</span></div>
        {report.top_deals.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th scope="col">Deal</th><th scope="col">Company</th><th scope="col">Owner</th><th scope="col">Stage</th><th scope="col">Amount ({currency})</th><th scope="col">Created</th><th scope="col">Status</th></tr></thead><tbody>{report.top_deals.map((deal) => <tr key={deal.id}><td><a href={`/app/deals/${deal.id}`}>{deal.title}</a></td><td>{deal.company || "—"}</td><td>{deal.owner}</td><td>{deal.stage || "—"}</td><td className="reports-amount">{money(deal.amount)}</td><td>{formatCalendarDate(deal.created_at, preferredDateFormat, { timeZone: "UTC" })}</td><td><span className={`reports-status reports-status-${deal.status}`}>{deal.status}</span></td></tr>)}</tbody></table></div> : <ChartEmpty>No deals match the selected creation date, owner, pipeline, and currency.</ChartEmpty>}
      </section>
    </main>
  );
}

function PanelHeading({ title, note }: { title: string; note: string }) {
  return <div className="reports-panel-heading"><div><h2>{title}</h2><p>{note}</p></div></div>;
}
function ChartEmpty({ children }: { children: React.ReactNode }) { return <p className="reports-chart-empty">{children}</p>; }
function BarList({ items, format }: { items: Array<{ key: string; label: string; value: number; detail: string }>; format: (value: number) => string }) {
  const max = Math.max(...items.map(({ value }) => value), 1);
  return <ul className="reports-bar-list">{items.map(({ key, label, value, detail }, index) => <li key={key}><div className="reports-bar-label"><span>{label}</span><strong>{detail}</strong></div><div className="reports-bar-track"><span className={`reports-bar-fill reports-bar-fill-${index % 4}`} style={{ width: `${Math.max(value ? value / max * 100 : 0, value ? 3 : 0)}%` }} /></div><span className="reports-visually-hidden">{format(value)}</span></li>)}</ul>;
}
function formatStageName(pipeline: string, stage: string) { return `${pipeline} · ${stage}`; }
function trendPath(values: number[]) {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 317 : 48 + index * (534 / (values.length - 1)), y: 152 - value / max * 124 }));
  return { points, path: points.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ") };
}
