"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertCircle, ArrowDownUp, CalendarDays, CheckCircle2, CircleDollarSign, Download, Layers3, List, Plus, Search, UsersRound } from "lucide-react";
import { shapeWorkspaceDashboard } from "@/lib/dashboard/presentation";
import type { DashboardDeal, DashboardSummary, WorkspaceDashboardData } from "@/lib/dashboard/types";
import { formatCalendarDate, formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";
import { useDateFormat } from "@/components/auth/date-format-provider";
import styles from "./dashboard-workspace.module.css";

type Props =
  | { state: "ready"; dashboard: WorkspaceDashboardData; canCreate: boolean }
  | { state: "unavailable"; canCreate: boolean };
type View = "table" | "pipeline";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
function date(dateValue: string | null, dateFormat: DateFormat) {
  return dateValue ? formatCalendarDate(dateValue.slice(0, 10), dateFormat) : "No close date";
}
function ago(occurredAt: string, timeZone: string, dateFormat: DateFormat) {
  return formatCalendarDateTime(occurredAt, dateFormat, timeZone);
}
function exportCsv(rows: DashboardDeal[]) {
  const cell = (fieldValue: unknown) => {
    const text = String(fieldValue ?? "");
    const safeText = /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const content = [
    ["Deal", "Company", "Contact", "Stage", "Value", "Currency", "Owner", "Expected close", "Status"],
    ...rows.map((deal) => [deal.title, deal.company, deal.contact, deal.stage, deal.amount, deal.currency, deal.owner, deal.expectedCloseDate, deal.status]),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "workspace-deals.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DashboardWorkspace(props: Props) {
  if (props.state === "unavailable") return <UnavailableDashboard />;
  return <DashboardPage dashboard={props.dashboard} canCreate={props.canCreate} />;
}

function UnavailableDashboard() {
  const router = useRouter();
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Sales Dashboard</h1><p>Workspace activity and sales work, in one place.</p></div></header>
    <section className={styles.error} role="alert"><AlertCircle aria-hidden="true" size={20} /><div><h2>Dashboard data could not be loaded</h2><p>Your workspace records are unchanged. Check your connection and try again.</p><button type="button" onClick={() => router.refresh()}>Try again</button></div></section>
  </main>;
}

type DashboardPageProps = { dashboard: WorkspaceDashboardData; canCreate: boolean };
function DashboardPage({ dashboard, canCreate }: DashboardPageProps) {
  const dateFormat = useDateFormat();
  const summary = shapeWorkspaceDashboard(dashboard);
  const period = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: dashboard.timeZone }).format(new Date(`${dashboard.today}T12:00:00Z`));
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1>Sales Dashboard</h1><p>Workspace activity and sales work, in one place.</p></div>
      <div className={styles.dateContext}><CalendarDays aria-hidden="true" size={16} /><span>{period}</span><span className={styles.today}>Updated {date(dashboard.today, dateFormat)}</span></div>
    </header>
    <DashboardMetrics summary={summary} currency={dashboard.currency} />
    <DashboardDealsPanel dashboard={dashboard} canCreate={canCreate} dateFormat={dateFormat} />
    <DashboardSupporting dashboard={dashboard} summary={summary} />
  </main>;
}

type DashboardMetricsProps = { summary: DashboardSummary; currency: string };
function DashboardMetrics({ summary, currency }: DashboardMetricsProps) {
  return <section className={styles.metrics} aria-label="Workspace sales summary">
    <Metric icon={<CircleDollarSign />} label="Total pipeline value" value={money(summary.pipelineValue, currency)} note="Open deals · workspace currency" tone="green" href="/app/deals" />
    <Metric icon={<Layers3 />} label="Open deals" value={summary.openDeals.toLocaleString()} note={`${summary.closingThisMonth} closing this month`} tone="blue" href="/app/deals" />
    <Metric icon={<UsersRound />} label="New leads" value={summary.newLeads.toLocaleString()} note="Created this month" tone="violet" href="/app/leads" />
    <Metric icon={<CheckCircle2 />} label="Won revenue" value={money(summary.wonRevenue, currency)} note="Won this month" tone="green" href="/app/deals" />
    <Metric icon={<CalendarDays />} label="Overdue tasks" value={summary.overdueTasks.toLocaleString()} note="Open tasks past due" tone={summary.overdueTasks ? "red" : "green"} href="/app/tasks?view=overdue" />
  </section>;
}

type DashboardDealsPanelProps = { dashboard: WorkspaceDashboardData; canCreate: boolean; dateFormat: DateFormat };
function DashboardDealsPanel({ dashboard, canCreate, dateFormat }: DashboardDealsPanelProps) {
  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [sort, setSort] = useState("close");
  const searchTerm = query.trim().toLocaleLowerCase();
  const visibleDeals = dashboard.deals.filter((deal) => (status === "all" || deal.status === status) && (!searchTerm || [deal.title, deal.company, deal.contact, deal.owner, deal.stage].some((fieldValue) => fieldValue?.toLocaleLowerCase().includes(searchTerm))))
    .sort((firstDeal, secondDeal) => sort === "amount" ? secondDeal.amount - firstDeal.amount : sort === "newest" ? secondDeal.createdAt.localeCompare(firstDeal.createdAt) : (firstDeal.expectedCloseDate ?? "9999").localeCompare(secondDeal.expectedCloseDate ?? "9999"));
  return <section className={styles.dealsPanel} aria-labelledby="deals-title">
    <div className={styles.panelHeader}>
      <div><h2 id="deals-title">Deals</h2><span className={styles.count}>{dashboard.deals.length} records</span><p>Your current workspace pipeline, ready for follow-up.</p></div>
      <div className={styles.actions}>
        <div className={styles.toggle} role="group" aria-label="Deal view">
          <button aria-pressed={view === "table"} onClick={() => setView("table")} type="button"><List size={15} />Table</button>
          <button aria-pressed={view === "pipeline"} onClick={() => setView("pipeline")} type="button"><Layers3 size={15} />Pipeline</button>
        </div>
        <label className={styles.selectControl}><span className={styles.srOnly}>Filter deals by status</span><select aria-label="Filter deals by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open deals</option><option value="all">All statuses</option><option value="won">Won</option><option value="lost">Lost</option></select></label>
        <label className={styles.selectControl}><ArrowDownUp aria-hidden="true" size={14} /><span className={styles.srOnly}>Sort deals</span><select aria-label="Sort deals" value={sort} onChange={(event) => setSort(event.target.value)}><option value="close">Expected close</option><option value="amount">Highest amount</option><option value="newest">Recently created</option></select></label>
        <button className={styles.secondaryButton} onClick={() => exportCsv(visibleDeals)} type="button"><Download size={15} />Export</button>
        {canCreate && <Link className={styles.primaryButton} href="/app/deals?create=1"><Plus size={15} />Add deal</Link>}
      </div>
    </div>
    <div className={styles.searchRow}><label><Search aria-hidden="true" size={16} /><span className={styles.srOnly}>Search deals</span><input aria-label="Search deals" onChange={(event) => setQuery(event.target.value)} placeholder="Search deals, companies, contacts…" value={query} /></label><span>{visibleDeals.length} shown</span></div>
    <DashboardDealResults dashboard={dashboard} deals={visibleDeals} canCreate={canCreate} view={view} dateFormat={dateFormat} />
  </section>;
}

type DashboardDealResultsProps = { dashboard: WorkspaceDashboardData; deals: DashboardDeal[]; canCreate: boolean; view: View; dateFormat: DateFormat };
function DashboardDealResults({ dashboard, deals, canCreate, view, dateFormat }: DashboardDealResultsProps) {
  if (deals.length === 0) return <div className={styles.empty}><Layers3 aria-hidden="true" size={20} /><h3>{dashboard.deals.length ? "No deals match these filters" : "No deals in this workspace yet"}</h3><p>{dashboard.deals.length ? "Try another search or status filter." : "Deals created in this workspace will appear here."}</p>{canCreate && !dashboard.deals.length && <Link href="/app/deals?create=1">Add your first deal</Link>}</div>;
  if (view === "table") return <div className={styles.tableScroll}><table><thead><tr><th>Deal</th><th>Company / contact</th><th>Stage</th><th>Value</th><th>Owner</th><th>Expected close</th><th>Status</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id}><td><Link className={styles.dealName} href={`/app/deals/${deal.id}`}>{deal.title}</Link></td><td>{deal.company ?? "—"}<small>{deal.contact ?? "No primary contact"}</small></td><td><span className={`${styles.stage} ${styles[`stage_${deal.stageType}`]}`}>{deal.stage}</span></td><td className={styles.amount}>{money(deal.amount, deal.currency)}</td><td>{deal.owner}</td><td>{date(deal.expectedCloseDate, dateFormat)}</td><td><span className={`${styles.status} ${styles[`status_${deal.status}`]}`}>{deal.status}</span></td></tr>)}</tbody></table></div>;
  return <div className={styles.pipelineBoard}>{dashboard.stages.map((stage) => { const stageDeals = deals.filter((deal) => deal.stageId === stage.id); return <section className={styles.pipelineColumn} key={stage.id}><header><h3>{stage.pipelineName} · {stage.name}</h3><span>{stageDeals.length}</span></header>{stageDeals.length ? stageDeals.map((deal) => <Link className={styles.pipelineDeal} href={`/app/deals/${deal.id}`} key={deal.id}><strong>{deal.title}</strong><span>{deal.company ?? "No company"}</span><b>{money(deal.amount, deal.currency)}</b></Link>) : <p className={styles.columnEmpty}>No deals</p>}</section>; })}</div>;
}

type DashboardSupportingProps = { dashboard: WorkspaceDashboardData; summary: DashboardSummary };
function DashboardSupporting({ dashboard, summary }: DashboardSupportingProps) {
  const dateFormat = useDateFormat();
  return <section className={styles.supporting} aria-label="Supporting workspace details">
    <section className={styles.widget} aria-labelledby="pipeline-heading"><WidgetHeading id="pipeline-heading" title="Pipeline by stage" href="/app/deals" /><ul className={styles.stageList}>{summary.pipelineByStage.length ? summary.pipelineByStage.map((stage) => <li key={stage.id}><span><i aria-hidden="true" />{stage.pipelineName} · {stage.name}</span><span>{stage.count} <b>{money(stage.value, dashboard.currency)}</b></span></li>) : <li className={styles.widgetEmpty}>No active pipeline stages.</li>}</ul></section>
    <section className={styles.widget} aria-labelledby="source-heading"><WidgetHeading id="source-heading" title="Deals by source" href="/app/deals" /><ul className={styles.sourceList}>{summary.dealsBySource.length ? summary.dealsBySource.slice(0, 5).map((source) => <li key={source.name}><span>{source.name}</span><span>{source.count} {source.count === 1 ? "deal" : "deals"}</span></li>) : <li className={styles.widgetEmpty}>Sources will appear as deals are added.</li>}</ul></section>
    <section className={styles.widget} aria-labelledby="activity-heading"><WidgetHeading id="activity-heading" title="Recent activity" href="/app/notifications" /><ul className={styles.activityList}>{dashboard.activities.length ? dashboard.activities.map((activity) => <li key={activity.id}><Activity aria-hidden="true" size={16} /><div><p>{activity.subject}{activity.relatedTo && <> · <Link href={activity.relatedHref ?? "/app/deals"}>{activity.relatedTo}</Link></>}</p><time dateTime={activity.occurredAt}>{ago(activity.occurredAt, dashboard.timeZone, dateFormat)}</time></div></li>) : <li className={styles.widgetEmpty}>Activity will appear here when your team records it.</li>}</ul></section>
    <section className={styles.widget} aria-labelledby="tasks-heading"><WidgetHeading id="tasks-heading" title="Tasks due today" href="/app/tasks?view=today" /><ul className={styles.taskList}>{summary.tasksToday.length ? summary.tasksToday.slice(0, 6).map((task) => <li key={task.id}><span className={styles.taskDot} aria-hidden="true" /><div><Link href={task.relatedHref ?? "/app/tasks"}>{task.title}</Link><small>{task.relatedTo ?? "No related record"}</small></div><time dateTime={task.dueAt}>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: dashboard.timeZone }).format(new Date(task.dueAt))}</time></li>) : <li className={styles.widgetEmpty}>No open tasks are due today.</li>}</ul></section>
    <section className={styles.widget} aria-labelledby="attention-heading"><WidgetHeading id="attention-heading" title="Deals needing attention" href="/app/deals" /><ul className={styles.attentionList}>{summary.attentionDeals.length ? summary.attentionDeals.map(({ deal, reason }) => <li key={deal.id}><AlertCircle aria-hidden="true" size={16} /><div><Link href={`/app/deals/${deal.id}`}>{deal.title}</Link><small>{reason}</small></div><span>{money(deal.amount, deal.currency)}</span></li>) : <li className={styles.widgetEmpty}>No open deals currently meet the attention rules.</li>}</ul></section>
  </section>;
}

function Metric({ icon, label, value, note, tone, href }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string; href: string }) {
  return <Link className={styles.metric} href={href}><span className={`${styles.metricIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><small>{note}</small></Link>;
}
function WidgetHeading({ id, title, href }: { id: string; title: string; href: string }) {
  return <header className={styles.widgetHeading}><h2 id={id}>{title}</h2><Link href={href}>View all</Link></header>;
}
