"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { createDemoRecords, formatCurrency, selectDemoReports, type CompanyRecord, type DealRecord, type LeadRecord, type TaskRecord } from "@/lib/dashboard-data";
import styles from "./demo.module.css";

type DemoSection = "leads" | "companies" | "deals" | "tasks" | "reports";

const pageCopy: Record<DemoSection, { title: string; description: string; searchLabel: string; searchPlaceholder: string }> = {
  leads: { title: "Leads", description: "Explore fictional prospects and their qualification details.", searchLabel: "Search leads", searchPlaceholder: "Search by name, company, owner, or source" },
  companies: { title: "Companies", description: "Browse the organizations represented in this sample workspace.", searchLabel: "Search companies", searchPlaceholder: "Search by company, industry, or owner" },
  deals: { title: "Deals", description: "Review sample opportunities across every pipeline stage.", searchLabel: "Search deals", searchPlaceholder: "Search by deal, contact, company, or owner" },
  tasks: { title: "Tasks", description: "See example follow-ups, owners, due dates, and priority.", searchLabel: "Search tasks", searchPlaceholder: "Search by task, company, or owner" },
  reports: { title: "Reports", description: "A read-only view of pipeline and sales measures derived from the sample records.", searchLabel: "Search top deals", searchPlaceholder: "Search the highest-value deals" },
};

function DataTable({ children, headings, label }: { children: React.ReactNode; headings: string[]; label: string }) {
  return <div className={styles.tableScroll}><table className={styles.table}>
    <caption className={styles.srOnly}>{label}</caption>
    <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}

function LeadsTable({ leads }: { leads: LeadRecord[] }) {
  return <DataTable headings={["Name", "Company", "Status", "Source", "Owner", "Estimated value", "Created"]} label="Fictional demo leads">
    {leads.map((lead) => <tr key={lead.id}><th scope="row"><Link href={`/demo/leads/${lead.id}`}>{lead.name}</Link></th><td>{lead.company}</td><td><span className={`${styles.pill} ${styles[`status${lead.status}`]}`}>{lead.status}</span></td><td>{lead.source}</td><td>{lead.owner}</td><td>{formatCurrency(lead.estimatedValue)}</td><td><time dateTime={lead.createdAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(lead.createdAt))}</time></td></tr>)}
  </DataTable>;
}

function CompaniesTable({ companies }: { companies: CompanyRecord[] }) {
  return <DataTable headings={["Company", "Industry", "Owner", "Contacts", "Open pipeline"]} label="Fictional demo companies">
    {companies.map((company) => <tr key={company.id}><th scope="row"><Link href={`/demo/companies/${company.id}`}>{company.name}</Link></th><td>{company.industry}</td><td>{company.owner}</td><td>{company.contactCount}</td><td>{formatCurrency(company.openPipeline)}</td></tr>)}
  </DataTable>;
}

function DealsTable({ deals }: { deals: DealRecord[] }) {
  return <DataTable headings={["Deal", "Contact", "Company", "Stage", "Value", "Owner", "Expected close", "Status"]} label="Fictional demo deals">
    {deals.map((deal) => <tr key={deal.id}><th scope="row"><Link href={`/demo/deals/${deal.id}`}>{deal.title}</Link></th><td>{deal.contact}</td><td>{deal.company}</td><td><span className={styles.pill}>{deal.stage}</span></td><td>{formatCurrency(deal.amount)}</td><td>{deal.owner}</td><td><time dateTime={deal.expectedCloseDate}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${deal.expectedCloseDate}T12:00:00`))}</time></td><td><span className={`${styles.pill} ${styles[`status${deal.status}`]}`}>{deal.status}</span></td></tr>)}
  </DataTable>;
}

function TasksTable({ tasks }: { tasks: TaskRecord[] }) {
  return <DataTable headings={["Task", "Related company", "Due", "Owner", "Priority", "Status"]} label="Fictional demo tasks">
    {tasks.map((task) => <tr key={task.id}><th scope="row">{task.title}</th><td>{task.relatedTo}</td><td><time dateTime={task.dueAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric" }).format(new Date(task.dueAt))}</time></td><td>{task.owner}</td><td><span className={`${styles.pill} ${styles[`priority${task.priority}`]}`}>{task.priority}</span></td><td>{task.status}</td></tr>)}
  </DataTable>;
}

function Reports({ query, records }: { query: string; records: ReturnType<typeof createDemoRecords> }) {
  const report = useMemo(() => selectDemoReports(records), [records]);
  const topDeals = report.topDeals.filter((deal) => `${deal.title} ${deal.company} ${deal.owner}`.toLowerCase().includes(query.trim().toLowerCase()));
  const maxStage = Math.max(...report.stageTotals.map((stage) => stage.amount), 1);

  return <>
    <section aria-label="Sample sales summary" className={styles.metrics}>
      <article><span>Won revenue</span><strong>{formatCurrency(report.wonRevenue)}</strong><small>Sum of won sample deals</small></article>
      <article><span>Total deals</span><strong>{report.totalDeals}</strong><small>All stages and outcomes</small></article>
      <article><span>Win rate</span><strong>{Math.round(report.winRate * 100)}%</strong><small>Won ÷ closed deals</small></article>
      <article><span>Average deal value</span><strong>{formatCurrency(report.averageDealValue)}</strong><small>Across all sample deals</small></article>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Pipeline by stage</h2><p>Current deal value in each stage · USD</p></div><strong>{formatCurrency(report.openPipeline)} open</strong></div>
      <div className={styles.stageList}>{report.stageTotals.map(({ stage, amount, count }) => <div className={styles.stageRow} key={stage}>
        <span>{stage}</span><span aria-label={`${formatCurrency(amount)} across ${count} deals`} className={styles.barTrack}><span style={{ width: `${(amount / maxStage) * 100}%` }} /></span><strong>{formatCurrency(amount)}</strong><small>{count}</small>
      </div>)}</div>
    </section>
    <section className={styles.analysisGrid}>
      <div className={styles.panel}><div className={styles.panelHeading}><div><h2>Deals by source</h2><p>Count of sample deals</p></div></div>
        {report.sourceTotals.length ? <ul className={styles.dataList}>{report.sourceTotals.map(({ source, count }) => <li key={source}><span>{source}</span><strong>{count}</strong></li>)}</ul> : <p className={styles.empty}>No deal source data.</p>}
      </div>
      <div className={styles.panel}><div className={styles.panelHeading}><div><h2>Performance by owner</h2><p>Open pipeline and won revenue · USD</p></div></div>
        {report.ownerTotals.length ? <ul className={styles.dataList}>{report.ownerTotals.map(({ owner, count, pipeline, wonRevenue }) => <li key={owner}><span><strong>{owner}</strong><small>{count} deals</small></span><span>{formatCurrency(pipeline)} pipeline<br /><small>{formatCurrency(wonRevenue)} won</small></span></li>)}</ul> : <p className={styles.empty}>No deal owner data.</p>}
      </div>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Top performing deals</h2><p>Highest value sample deals · {report.totalContacts} sample contacts · {report.totalLeads} sample leads · {report.completedTasks} completed tasks</p></div></div>
      {topDeals.length ? <DataTable headings={["Deal", "Company", "Owner", "Stage", "Value", "Status"]} label="Highest-value fictional deals">
        {topDeals.map((deal) => <tr key={deal.id}><th scope="row">{deal.title}</th><td>{deal.company}</td><td>{deal.owner}</td><td>{deal.stage}</td><td>{formatCurrency(deal.amount)}</td><td>{deal.status}</td></tr>)}
      </DataTable> : <p className={styles.empty}>No deals match your search.</p>}
    </section>
  </>;
}

function SearchField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <label className={styles.search}>
    <Search aria-hidden="true" size={16} />
    <span className={styles.srOnly}>{label}</span>
    <input aria-label={label} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
  </label>;
}

function RecordsSection({ section, records, query, status, onQueryChange, onStatusChange }: {
  section: Exclude<DemoSection, "reports">;
  records: ReturnType<typeof createDemoRecords>;
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const copy = pageCopy[section];
  const normalizedQuery = query.trim().toLowerCase();
  const leads = records.leads.filter((lead) => (status === "all" || lead.status === status) && `${lead.name} ${lead.company} ${lead.owner} ${lead.source}`.toLowerCase().includes(normalizedQuery));
  const companies = records.companies.filter((company) => `${company.name} ${company.industry} ${company.owner}`.toLowerCase().includes(normalizedQuery));
  const deals = records.deals.filter((deal) => (status === "all" || deal.status === status) && `${deal.title} ${deal.contact} ${deal.company} ${deal.owner}`.toLowerCase().includes(normalizedQuery));
  const tasks = records.tasks.filter((task) => (status === "all" || task.status === status) && `${task.title} ${task.relatedTo} ${task.owner}`.toLowerCase().includes(normalizedQuery));
  const recordCount = section === "leads" ? leads.length : section === "companies" ? companies.length : section === "deals" ? deals.length : tasks.length;
  const statusOptions = section === "leads" ? ["New", "Contacted", "Qualified", "Unqualified"] : section === "deals" ? ["open", "won", "lost"] : ["open", "completed", "cancelled"];

  return <>
    <div className={styles.toolbar}>
      <SearchField label={copy.searchLabel} onChange={onQueryChange} placeholder={copy.searchPlaceholder} value={query} />
      {section !== "companies" && <label className={styles.filter}>Filter by status
        <select aria-label="Filter by status" onChange={(event) => onStatusChange(event.target.value)} value={status}>
          <option value="all">All {section}</option>
          {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>}
      <span aria-live="polite" className={styles.resultCount}>{recordCount} records</span>
    </div>
    <section aria-label={`${copy.title} sample records`} className={styles.panel}>
      {section === "leads" && <LeadsTable leads={leads} />}
      {section === "companies" && <CompaniesTable companies={companies} />}
      {section === "deals" && <DealsTable deals={deals} />}
      {section === "tasks" && <TasksTable tasks={tasks} />}
      {!recordCount && <p className={styles.empty}>No records match this search and filter.</p>}
    </section>
  </>;
}

export function DemoWorkspaceSection({ section }: { section: DemoSection }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const records = useMemo(() => createDemoRecords(), []);
  const copy = pageCopy[section];
  const normalizedQuery = query.trim().toLowerCase();

  return <div className={styles.content}>
    <header className={styles.pageHeader}><div><h1>{copy.title}</h1><p>{copy.description}</p></div><span className={styles.sampleTag}>Sample data</span></header>
    {section === "reports" ? <>
      <div className={styles.toolbar}><SearchField label={copy.searchLabel} onChange={setQuery} placeholder={copy.searchPlaceholder} value={query} /><span className={styles.resultCount}>Derived from sample records</span></div>
      <Reports query={normalizedQuery} records={records} />
    </> : <RecordsSection onQueryChange={setQuery} onStatusChange={setStatus} query={query} records={records} section={section} status={status} />}
  </div>;
}
