import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, type CompanyRecord, type LeadRecord, type TaskRecord } from "@/lib/dashboard-data";
import styles from "./demo-lead-detail.module.css";

type DemoLeadDetailProps = {
  lead: LeadRecord;
  company: CompanyRecord | undefined;
  companyTasks: TaskRecord[];
};

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", options).format(date);
};

function LeadProperties({ lead }: { lead: LeadRecord }) {
  return <dl className={styles.properties}>
    <div><dt>Status</dt><dd><span className={`${styles.pill} ${styles[`status${lead.status}`]}`}>{lead.status}</span></dd></div>
    <div><dt>Estimated value</dt><dd>{formatCurrency(lead.estimatedValue)}</dd></div>
    <div><dt>Source</dt><dd>{lead.source}</dd></div>
    <div><dt>Tags</dt><dd>Not included in sample data</dd></div>
    <div><dt>Contact fields</dt><dd>Not included in sample data</dd></div>
    <div><dt>Owner</dt><dd>{lead.owner}</dd></div>
    <div><dt>Created</dt><dd><time dateTime={lead.createdAt}>{formatDate(lead.createdAt)}</time></dd></div>
  </dl>;
}

function CompanySummary({ company, name }: { company: CompanyRecord | undefined; name: string }) {
  return <section aria-labelledby="lead-company-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="lead-company-heading">Company summary · exact name match</h2></div>
    {company ? <dl className={styles.companyFacts}>
      <div><dt>Company</dt><dd>{company.name}</dd></div>
      <div><dt>Industry</dt><dd>{company.industry}</dd></div>
      <div><dt>Company owner</dt><dd>{company.owner}</dd></div>
      <div><dt>Contacts in company record</dt><dd>{company.contactCount}</dd></div>
      <div><dt>Open pipeline</dt><dd>{formatCurrency(company.openPipeline)}</dd></div>
    </dl> : <p className={styles.empty} role="status">No company record with the exact name “{name}” is present in the sample.</p>}
  </section>;
}

function CompanyTasks({ tasks, company }: { tasks: TaskRecord[]; company: string }) {
  return <section aria-labelledby="lead-tasks-heading" className={styles.panel} id="tasks">
    <div className={styles.sectionHeading}><h2 id="lead-tasks-heading">Company-related tasks</h2><span>{tasks.length}</span></div>
    <p className={styles.sectionNote}>These tasks are related to {company}, not to this lead, and are not assigned to the lead.</p>
    {tasks.length ? <ul className={styles.taskList}>
      {tasks.map((task) => <li key={task.id}>
        <div><strong>{task.title}</strong><span>{task.status} · {task.priority} priority · Owner: {task.owner}</span></div>
        <time dateTime={task.dueAt}>{formatDate(task.dueAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric" })}</time>
      </li>)}
    </ul> : <p className={styles.empty} role="status">No sample tasks are related to this company.</p>}
  </section>;
}

function LeadActivity() {
  return <section aria-labelledby="lead-activity-heading" className={styles.panel} id="activity">
    <div className={styles.sectionHeading}><h2 id="lead-activity-heading">Activity</h2></div>
    <p className={styles.empty} role="status">No lead-specific activity, or last/next activity, is available in the sample records.</p>
  </section>;
}

function LeadNotesAndFiles() {
  return <>
    <section aria-labelledby="lead-notes-heading" className={styles.panel} id="notes">
      <div className={styles.sectionHeading}><h2 id="lead-notes-heading">Notes</h2></div>
      <p className={styles.empty} role="status">No lead-specific notes are included in the sample data.</p>
    </section>
    <section aria-labelledby="lead-files-heading" className={styles.panel} id="files">
      <div className={styles.sectionHeading}><h2 id="lead-files-heading">Files</h2></div>
      <p className={styles.empty} role="status">No lead-specific files are included in the sample data.</p>
    </section>
  </>;
}

export function DemoLeadDetail({ lead, company, companyTasks }: DemoLeadDetailProps) {
  return <div className={styles.content}>
    <Link className={styles.backLink} href="/demo/leads"><ArrowLeft aria-hidden="true" size={16} />Back to leads</Link>
    <header className={styles.pageHeader}>
      <div><h1>{lead.name}</h1><p>{lead.company} · {lead.status} · {formatCurrency(lead.estimatedValue)}</p></div>
      <span className={styles.sampleTag}>Fictional · read-only</span>
    </header>
    <nav aria-label="Lead detail sections" className={styles.sectionNav}>
      <a href="#overview">Overview</a><a href="#activity">Activity</a><a href="#tasks">Tasks</a><a href="#notes">Notes</a><a href="#files">Files</a>
    </nav>
    <div className={styles.detailGrid}>
      <div>
        <section aria-labelledby="lead-overview-heading" className={styles.panel} id="overview">
          <div className={styles.sectionHeading}><h2 id="lead-overview-heading">Overview</h2></div>
          <p className={styles.overviewCopy}>This fictional lead record includes the supplied qualification details. Activity, contact, note, and file relationships are not represented in this sample.</p>
          <dl className={styles.overviewFacts}>
            <div><dt>Name</dt><dd>{lead.name}</dd></div><div><dt>Company</dt><dd>{lead.company}</dd></div>
            <div><dt>Status</dt><dd>{lead.status}</dd></div><div><dt>Estimated value</dt><dd>{formatCurrency(lead.estimatedValue)}</dd></div>
          </dl>
        </section>
        <CompanySummary company={company} name={lead.company} />
        <LeadActivity />
        <CompanyTasks company={lead.company} tasks={companyTasks} />
        <LeadNotesAndFiles />
      </div>
      <aside aria-label="Lead details" className={styles.rail}>
        <section aria-labelledby="lead-properties-heading" className={styles.panel}>
          <div className={styles.sectionHeading}><h2 id="lead-properties-heading">Lead properties</h2></div>
          <LeadProperties lead={lead} />
        </section>
        <section aria-labelledby="lead-activity-summary-heading" className={styles.panel}>
          <div className={styles.sectionHeading}><h2 id="lead-activity-summary-heading">Last / next activity</h2></div>
          <p className={styles.empty}>Not available for this lead in the sample data.</p>
        </section>
      </aside>
    </div>
  </div>;
}
