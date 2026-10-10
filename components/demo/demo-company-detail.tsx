import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, type ActivityRecord, type CompanyRecord, type ContactRecord, type DashboardRecords, type DealRecord, type TaskRecord } from "@/lib/dashboard-data";
import styles from "./demo-company-detail.module.css";

type DemoCompanyDetailProps = {
  company: CompanyRecord;
  records: DashboardRecords;
  now: Date;
};

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", options).format(date);
};

function CompanyMark({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={styles.companyMark}>{initials}</span>;
}

function CompanyMetrics({
  openDealValue,
  contacts,
  openDeals,
  lastActivity,
}: {
  openDealValue: number;
  contacts: ContactRecord[];
  openDeals: DealRecord[];
  lastActivity: ActivityRecord | undefined;
}) {
  return <section aria-label="Company summary metrics" className={styles.metrics}>
    <article><span>Open deal value</span><strong>{formatCurrency(openDealValue)}</strong></article>
    <article><span>Contacts</span><strong>{contacts.length}</strong></article>
    <article><span>Active deals</span><strong>{openDeals.length}</strong><small>Open status</small></article>
    <article><span>Last activity</span><strong>{lastActivity ? formatDate(lastActivity.occurredAt) : "—"}</strong><small>{lastActivity ? lastActivity.title : "No sample activity"}</small></article>
  </section>;
}

function CompanyProperties({ company, contacts, openDealValue }: { company: CompanyRecord; contacts: ContactRecord[]; openDealValue: number }) {
  return <dl className={styles.properties}>
    <div><dt>Industry</dt><dd>{company.industry}</dd></div>
    <div><dt>Owner</dt><dd>{company.owner}</dd></div>
    <div><dt>Contacts in sample</dt><dd>{contacts.length}</dd></div>
    <div><dt>Open deal value</dt><dd>{formatCurrency(openDealValue)}</dd></div>
    <div><dt>Domain</dt><dd>Not included in sample data</dd></div>
    <div><dt>Employee band</dt><dd>Not included in sample data</dd></div>
  </dl>;
}

function ContactsSection({ contacts }: { contacts: ContactRecord[] }) {
  return <section aria-labelledby="company-contacts-heading" className={styles.panel} id="contacts">
    <div className={styles.sectionHeading}><h2 id="company-contacts-heading">Contacts</h2><span>{contacts.length}</span></div>
    {contacts.length ? <ul className={styles.contactList}>
      {contacts.map((contact) => <li key={contact.id}>
        <Link href={`/demo/contacts/${contact.id}`}>{contact.name}</Link>
        <span>{contact.jobTitle}</span>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
      </li>)}
    </ul> : <p className={styles.empty} role="status">No sample contacts match this company name.</p>}
  </section>;
}

function DealsSection({ deals }: { deals: DealRecord[] }) {
  return <section aria-labelledby="company-deals-heading" className={styles.panel} id="deals">
    <div className={styles.sectionHeading}><h2 id="company-deals-heading">Deals</h2><span>{deals.length}</span></div>
    <p className={styles.sectionNote}>Deals matched by company name; these are opportunities associated with this company.</p>
    {deals.length ? <div className={styles.tableScroll}><table className={styles.table}>
      <caption className={styles.srOnly}>Sample deals whose company name matches {deals[0].company}</caption>
      <thead><tr><th scope="col">Deal</th><th scope="col">Stage</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Expected close</th></tr></thead>
      <tbody>{deals.map((deal) => <tr key={deal.id}>
        <th scope="row"><Link href={`/demo/deals/${deal.id}`}>{deal.title}</Link></th>
        <td>{deal.stage}</td><td><span className={`${styles.pill} ${styles[`status${deal.status}`]}`}>{deal.status}</span></td>
        <td>{formatCurrency(deal.amount)}</td><td><time dateTime={deal.expectedCloseDate}>{formatDate(deal.expectedCloseDate)}</time></td>
      </tr>)}</tbody>
    </table></div> : <p className={styles.empty} role="status">No sample deals are associated with this company name.</p>}
  </section>;
}

function ActivitySection({ activities, companyName }: { activities: ActivityRecord[]; companyName: string }) {
  return <section aria-labelledby="company-activity-heading" className={styles.panel} id="activity">
    <div className={styles.sectionHeading}><h2 id="company-activity-heading">Activity</h2><span>{activities.length}</span></div>
    <p className={styles.sectionNote}>Sample activities whose detail mentions {companyName}.</p>
    {activities.length ? <ol className={styles.activityList}>
      {activities.map((activity) => <li key={activity.id}>
        <div><strong>{activity.title}</strong><p>{activity.detail}</p></div>
        <time dateTime={activity.occurredAt}>{formatDate(activity.occurredAt)}</time>
      </li>)}
    </ol> : <p className={styles.empty} role="status">No sample activity detail mentions this company.</p>}
  </section>;
}

function TasksSection({ tasks, companyName }: { tasks: TaskRecord[]; companyName: string }) {
  return <section aria-labelledby="company-tasks-heading" className={styles.panel} id="tasks">
    <div className={styles.sectionHeading}><h2 id="company-tasks-heading">Tasks</h2><span>{tasks.length}</span></div>
    <p className={styles.sectionNote}>Tasks with an exact related-to match for {companyName}; this relationship is to the company, not to a specific deal.</p>
    {tasks.length ? <ul className={styles.taskList}>
      {tasks.map((task) => <li key={task.id}>
        <div><strong>{task.title}</strong><span>{task.status} · {task.priority} priority · {task.owner}</span></div>
        <time dateTime={task.dueAt}>{formatDate(task.dueAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric" })}</time>
      </li>)}
    </ul> : <p className={styles.empty} role="status">No sample tasks are related to this company.</p>}
  </section>;
}

function CompanyNotesAndFiles() {
  return <>
    <section aria-labelledby="company-notes-heading" className={styles.panel} id="notes">
      <div className={styles.sectionHeading}><h2 id="company-notes-heading">Notes</h2></div>
      <p className={styles.empty} role="status">No dedicated company notes are included in this sample data.</p>
    </section>
    <section aria-labelledby="company-files-heading" className={styles.panel} id="files">
      <div className={styles.sectionHeading}><h2 id="company-files-heading">Files</h2></div>
      <p className={styles.empty} role="status">No company files are included in this sample data.</p>
    </section>
  </>;
}

export function DemoCompanyDetail({ company, records, now }: DemoCompanyDetailProps) {
  const contacts = records.contacts.filter((contact) => contact.company === company.name);
  const deals = records.deals.filter((deal) => deal.company === company.name);
  const openDeals = deals.filter((deal) => deal.status === "open");
  const openDealValue = openDeals.reduce((total, deal) => total + deal.amount, 0);
  const activities = records.activities
    .filter((activity) => activity.detail.includes(company.name))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const tasks = records.tasks
    .filter((task) => task.relatedTo === company.name)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const nextTask = tasks.find((task) => task.status === "open");
  const lastActivity = activities[0];

  return <div className={styles.content}>
    <Link className={styles.backLink} href="/demo/companies"><ArrowLeft aria-hidden="true" size={16} />Back to companies</Link>
    <header className={styles.pageHeader}>
      <div className={styles.companyHeading}><CompanyMark name={company.name} /><div><h1>{company.name}</h1><p>{company.industry} · Owned by {company.owner}</p></div></div>
      <span className={styles.sampleTag}>Fictional · read-only</span>
    </header>
    <CompanyMetrics contacts={contacts} lastActivity={lastActivity} openDealValue={openDealValue} openDeals={openDeals} />
    <nav aria-label="Company detail sections" className={styles.sectionNav}>
      <a href="#overview">Overview</a><a href="#contacts">Contacts</a><a href="#deals">Deals</a><a href="#activity">Activity</a><a href="#tasks">Tasks</a><a href="#notes">Notes</a><a href="#files">Files</a>
    </nav>
    <div className={styles.detailGrid}>
      <div>
        <section aria-labelledby="company-overview-heading" className={styles.panel} id="overview">
          <div className={styles.sectionHeading}><h2 id="company-overview-heading">Overview</h2></div>
          <p className={styles.overviewCopy}>This sample company record includes its industry, owner, contact count, and open pipeline. Related details below are matched from the same fictional sample records.</p>
          <dl className={styles.overviewFacts}><div><dt>Industry</dt><dd>{company.industry}</dd></div><div><dt>Company owner</dt><dd>{company.owner}</dd></div></dl>
        </section>
        <ContactsSection contacts={contacts} />
        <DealsSection deals={deals} />
        <ActivitySection activities={activities} companyName={company.name} />
        <TasksSection tasks={tasks} companyName={company.name} />
        <CompanyNotesAndFiles />
      </div>
      <aside aria-label="Company details" className={styles.rail}>
        <section aria-labelledby="company-properties-heading" className={styles.panel}>
          <div className={styles.sectionHeading}><h2 id="company-properties-heading">Company properties</h2></div>
          <CompanyProperties company={company} contacts={contacts} openDealValue={openDealValue} />
        </section>
        <section aria-labelledby="key-contacts-heading" className={styles.panel}>
          <div className={styles.sectionHeading}><h2 id="key-contacts-heading">Key contacts</h2><span>{contacts.length}</span></div>
          {contacts.length ? <ul className={styles.keyContacts}>{contacts.map((contact) => <li key={contact.id}><Link href={`/demo/contacts/${contact.id}`}>{contact.name}</Link><span>{contact.jobTitle}</span></li>)}</ul> : <p className={styles.empty} role="status">No sample contacts match this company.</p>}
        </section>
        <section aria-labelledby="next-task-heading" className={styles.panel}>
          <div className={styles.sectionHeading}><h2 id="next-task-heading">Next open task</h2></div>
          {nextTask ? <div className={styles.nextTask}><strong>{nextTask.title}</strong><span>{new Date(nextTask.dueAt) < now ? "Overdue · " : ""}{nextTask.owner} · {nextTask.priority} priority</span><time dateTime={nextTask.dueAt}>{formatDate(nextTask.dueAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric" })}</time></div> : <p className={styles.empty} role="status">No open company-related task is present in this sample.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
