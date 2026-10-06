"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowDownWideNarrow, ArrowRightLeft, ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Download, FileText, Filter, Handshake, Layers3, LayoutGrid, List, ListChecks, Plus, Search, UsersRound } from "lucide-react";
import { createDemoRecords, formatCurrency, selectDashboard, selectVisibleDeals, type DateScope, type DealSort } from "@/lib/dashboard-data";

const dateScopes: { label: string; value: DateScope }[] = [
  { label: "This month", value: "month" },
  { label: "Last 30 days", value: "30days" },
  { label: "This quarter", value: "quarter" },
  { label: "All time", value: "all" },
];

function MetricCard({ label, value, note, icon: Icon, tone, href }: { label: string; value: string; note: string; icon: typeof Layers3; tone: string; href?: string }) {
  const content = <>
    <span className={`metric-icon ${tone}`}><Icon aria-hidden="true" size={18} /></span>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <span className="metric-note">{note}</span>
  </>;
  return href ? <Link className="metric-card metric-link" href={href}>{content}<ArrowUpRight aria-hidden="true" className="metric-arrow" size={15} /></Link> : <article className="metric-card">{content}</article>;
}

function DealTable({ deals, tasks, now }: { deals: ReturnType<typeof selectVisibleDeals>; tasks: ReturnType<typeof createDemoRecords>["tasks"]; now: Date }) {
  if (!deals.length) return <div className="dashboard-empty">No deals match this view. Try another date range or clear the search and filter.</div>;
  return <div className="deal-table-scroll"><table className="deal-table">
    <thead><tr><th scope="col">Contact</th><th scope="col">Company</th><th scope="col">Stage</th><th scope="col">Value</th><th scope="col">Owner</th><th scope="col">Next activity</th><th scope="col">Status</th></tr></thead>
    <tbody>{deals.map((deal) => {
      const nextTask = tasks.filter((task) => task.status === "open" && task.relatedTo === deal.company && new Date(task.dueAt) > now).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
      return <tr key={deal.id}>
      <td><span className="deal-primary">{deal.contact}</span><span className="deal-secondary">{deal.title}</span></td>
      <td>{deal.company}</td><td><span className={`stage-pill stage-${deal.stage.toLowerCase()}`}>{deal.stage}</span></td>
      <td className="numeric-cell">{formatCurrency(deal.amount)}</td><td>{deal.owner}</td>
      <td>{nextTask ? `${nextTask.title} · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(nextTask.dueAt))}` : "No upcoming task"}</td><td><span className={`status-pill status-${deal.status}`}>{deal.status}</span></td>
    </tr>;
    })}</tbody>
  </table></div>;
}

function DealBoard({ deals }: { deals: ReturnType<typeof selectVisibleDeals> }) {
  const stages = ["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
  if (!deals.length) return <div className="dashboard-empty">No deals match this view. Try another date range or clear the search and filter.</div>;
  return <div aria-label="Deals by pipeline stage" className="deal-board" role="region">{stages.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    return <section className="board-column" key={stage}>
      <header><span className={`board-stage-dot stage-dot-${stage.toLowerCase()}`} /><h3>{stage}</h3><span className="board-count">{stageDeals.length}</span></header>
      <p className="board-total">{formatCurrency(stageDeals.reduce((sum, deal) => sum + deal.amount, 0))}</p>
      {stageDeals.length ? stageDeals.map((deal) => <article className="board-deal" key={deal.id}><strong>{deal.title}</strong><span>{deal.company}</span><div><b>{formatCurrency(deal.amount)}</b><small>{deal.owner}</small></div></article>) : <p className="board-empty">No deals</p>}
    </section>;
  })}</div>;
}

function PipelineWidget({ stages }: { stages: ReturnType<typeof selectDashboard>["stageTotals"] }) {
  const peakAmount = Math.max(...stages.map((stage) => stage.amount), 0);
  const hasDeals = stages.some((stage) => stage.count > 0);
  return <section aria-labelledby="pipeline-title" className="support-panel pipeline-panel">
    <div className="panel-heading"><div><h2 id="pipeline-title">Pipeline by stage</h2><p>Deal value in the selected period</p></div><span className="mini-legend">USD</span></div>
    {hasDeals ? <div className="stage-bars">{stages.map((stage) => <div className="stage-bar-item" key={stage.stage}>
      <div className="stage-bar-value">{stage.amount ? formatCurrency(stage.amount) : "—"}</div>
      <div aria-label={`${stage.stage}: ${stage.count} deals, ${formatCurrency(stage.amount)}`} className="stage-bar-track"><span className={`stage-bar-fill stage-fill-${stage.stage.toLowerCase()}`} style={{ height: stage.amount ? `${(stage.amount / peakAmount) * 100}%` : "0%" }} /></div>
      <span className="stage-bar-label">{stage.stage}</span>
      <span className="stage-bar-count">{stage.count} deals</span>
    </div>)}</div> : <div className="widget-empty">No deals in this date range.</div>}
  </section>;
}

function SourceWidget({ sources }: { sources: ReturnType<typeof selectDashboard>["sourceTotals"] }) {
  const total = sources.reduce((sum, source) => sum + source.count, 0);
  return <section aria-labelledby="sources-title" className="support-panel source-panel">
    <div className="panel-heading"><div><h2 id="sources-title">Deals by source</h2><p>Records in the selected period</p></div></div>
    {total ? <div className="source-list">{sources.map((source, index) => <div className="source-row" key={source.source}><span className={`source-swatch source-swatch-${index % 5}`} /><span>{source.source}</span><div className="source-track"><span style={{ width: `${(source.count / total) * 100}%` }} /></div><strong>{source.count}</strong></div>)}</div> : <div className="widget-empty">Source breakdown appears when deals are available.</div>}
  </section>;
}

function ActivityWidget({ activities }: { activities: ReturnType<typeof selectDashboard>["activities"] }) {
  const ActivityIcon = { meeting: UsersRound, call: Activity, email: Download, won: CheckCircle2, note: FileText, stageChange: ArrowRightLeft, taskCompletion: ListChecks };
  return <section aria-labelledby="activity-title" className="support-panel activity-panel">
    <div className="panel-heading"><div><h2 id="activity-title">Recent activity</h2><p>Latest workspace updates</p></div><Link href="/demo/deals">Deals <ArrowUpRight aria-hidden="true" size={13} /></Link></div>
    {activities.length ? <ul className="activity-list">{activities.slice(0, 4).map((activity) => {
      const Icon = ActivityIcon[activity.kind];
      return <li key={activity.id}><span className={`activity-icon activity-${activity.kind}`}><Icon aria-hidden="true" size={15} /></span><div><strong>{activity.title}</strong><span>{activity.detail}</span><time dateTime={activity.occurredAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(activity.occurredAt))}</time></div></li>;
    })}</ul> : <div className="widget-empty">No activity in this date range.</div>}
  </section>;
}

function TaskWidget({ tasks, now }: { tasks: ReturnType<typeof selectDashboard>["dueToday"]; now: Date }) {
  return <section aria-labelledby="tasks-title" className="support-panel tasks-panel">
    <div className="panel-heading"><div><h2 id="tasks-title">Tasks due today</h2><p>{tasks.length} open task{tasks.length === 1 ? "" : "s"}</p></div><Link href="/demo/tasks">View tasks <ArrowUpRight aria-hidden="true" size={13} /></Link></div>
    {tasks.length ? <ul className="dashboard-task-list">{tasks.map((task) => <li key={task.id}><span className={`task-priority priority-${task.priority.toLowerCase()}`} /><div><strong>{task.title}</strong><span>{task.relatedTo}</span></div><time dateTime={task.dueAt}>{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(task.dueAt))}</time></li>)}</ul> : <div className="widget-empty"><CheckCircle2 aria-hidden="true" size={18} /> No open tasks due today.</div>}
    <span className="sr-only">As of {now.toLocaleDateString("en-US")}</span>
  </section>;
}

function AttentionWidget({ attentionDeals }: { attentionDeals: ReturnType<typeof selectDashboard>["attentionDeals"] }) {
  return <section aria-labelledby="attention-title" className="support-panel attention-panel">
    <div className="panel-heading"><div><h2 id="attention-title">Deals needing attention</h2><p>Open deals with a follow-up risk</p></div><Link href="/demo/deals">View deals <ArrowUpRight aria-hidden="true" size={13} /></Link></div>
    {attentionDeals.length ? <ul className="attention-list">{attentionDeals.slice(0, 4).map(({ deal, reasons }) => <li key={deal.id}><span className="attention-dot" /><div><strong>{deal.company}</strong><span>{reasons[0]}</span></div><b>{formatCurrency(deal.amount)}</b></li>)}</ul> : <div className="widget-empty"><CheckCircle2 aria-hidden="true" size={18} /> No deals need attention.</div>}
  </section>;
}

function downloadDealsCsv(deals: ReturnType<typeof selectVisibleDeals>) {
  const fields = ["Deal", "Contact", "Company", "Stage", "Value USD", "Owner", "Expected close", "Status"];
  const escapeCell = (cell: string | number) => `"${String(cell).replaceAll('"', '""')}"`;
  const rows = deals.map((deal) => [deal.title, deal.contact, deal.company, deal.stage, deal.amount, deal.owner, deal.expectedCloseDate, deal.status]);
  const csv = [fields, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nexa-demo-deals.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SalesDashboard() {
  const [scope, setScope] = useState<DateScope>("30days");
  const [view, setView] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [sort, setSort] = useState<DealSort>("closeDate");
  const [exportNotice, setExportNotice] = useState("");
  const now = useMemo(() => new Date(), []);
  const records = useMemo(() => createDemoRecords(now), [now]);
  const summary = useMemo(() => selectDashboard(records, scope, now), [records, scope, now]);
  const visibleDeals = useMemo(() => selectVisibleDeals(summary.scopedDeals, query, filter, sort, records.tasks, now), [summary.scopedDeals, query, filter, sort, records.tasks, now]);

  return <div className="page-container dashboard-page">
    <header className="dashboard-header">
      <div><h1 className="page-title">Sales Dashboard</h1><p className="page-description">A clear view of your pipeline and today’s priorities.</p></div>
      <label className="date-scope-control"><CalendarDays aria-hidden="true" size={16} /><span className="sr-only">Dashboard date range</span><select aria-label="Dashboard date range" onChange={(event) => setScope(event.target.value as DateScope)} value={scope}>{dateScopes.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}</select></label>
    </header>
    <aside aria-label="Sample data notice" className="demo-notice"><span className="demo-indicator" /><div><strong>Sample demo workspace</strong><span>Fictional records for preview only — not live customer data. Nothing here is saved.</span></div></aside>
    <section aria-label="Sales key performance indicators" className="metric-grid">
      <MetricCard label="Total pipeline value" value={formatCurrency(summary.pipelineValue)} note="Current open deals · USD" icon={CircleDollarSign} tone="tone-green" />
      <MetricCard label="Open deals" value={String(summary.openDealCount)} note="Across all open stages" icon={Layers3} tone="tone-blue" href="/demo/deals" />
      <MetricCard label="New leads" value={String(summary.newLeadCount)} note={dateScopes.find(({ value }) => value === scope)?.label ?? "Selected period"} icon={UsersRound} tone="tone-violet" href="/demo/leads" />
      <MetricCard label="Won revenue" value={formatCurrency(summary.wonRevenue)} note="Closed won in selected period" icon={Handshake} tone="tone-green" />
      <MetricCard label="Overdue tasks" value={String(summary.overdueTaskCount)} note="Open and past due" icon={Clock3} tone="tone-red" href="/demo/tasks" />
    </section>
    <section aria-labelledby="deals-title" className="deals-panel">
      <div className="deals-heading"><div><div className="deals-title-row"><h2 id="deals-title">Deal overview</h2><span className="record-count">{visibleDeals.length} deals</span></div><p>Deals created in the selected period</p></div>
        <div className="deal-actions"><div aria-label="Deal view" className="view-toggle" role="group"><button aria-pressed={view === "table"} onClick={() => setView("table")} type="button"><List aria-hidden="true" size={15} /> Table</button><button aria-pressed={view === "board"} onClick={() => setView("board")} type="button"><LayoutGrid aria-hidden="true" size={15} /> Kanban</button></div>
          <label className="toolbar-select"><Filter aria-hidden="true" size={15} /><span className="sr-only">Filter deals</span><select aria-label="Filter deals" onChange={(event) => setFilter(event.target.value as "all" | "attention")} value={filter}><option value="all">All deals</option><option value="attention">Needs attention</option></select></label>
          <label className="toolbar-select"><ArrowDownWideNarrow aria-hidden="true" size={15} /><span className="sr-only">Sort deals</span><select aria-label="Sort deals" onChange={(event) => setSort(event.target.value as DealSort)} value={sort}><option value="closeDate">Close date</option><option value="amount">Deal value</option><option value="newest">Recently added</option></select></label>
          <button className="toolbar-button export-button" onClick={() => { downloadDealsCsv(visibleDeals); setExportNotice(`Exported ${visibleDeals.length} deals as CSV.`); }} type="button"><Download aria-hidden="true" size={15} /> Export</button>
          <button aria-describedby="add-deal-note" className="toolbar-button add-deal-button" disabled title="Deal creation is not available in this foundation build" type="button"><Plus aria-hidden="true" size={16} /> Add deal</button>
        </div>
      </div>
      <div className="deal-toolbar"><label className="deal-search"><Search aria-hidden="true" size={15} /><span className="sr-only">Search deals</span><input aria-label="Search deals" onChange={(event) => setQuery(event.target.value)} placeholder="Search deals, contacts, companies…" value={query} /></label><span aria-live="polite" className="export-notice">{exportNotice}</span><span className="sr-only" id="add-deal-note">Creating records is not available because no CRM backend is connected.</span></div>
      {view === "table" ? <DealTable deals={visibleDeals} now={now} tasks={records.tasks} /> : <DealBoard deals={visibleDeals} />}
    </section>
    <div className="support-grid">
      <PipelineWidget stages={summary.stageTotals} /><SourceWidget sources={summary.sourceTotals} /><ActivityWidget activities={summary.activities} />
      <TaskWidget now={now} tasks={summary.dueToday} /><AttentionWidget attentionDeals={summary.attentionDeals} />
    </div>
  </div>;
}
