import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, type ActivityRecord, type ContactRecord, type DealRecord, type TaskRecord } from "@/lib/dashboard-data";
import styles from "./demo-deal-detail.module.css";

type DemoDealDetailProps = {
  deal: DealRecord;
  contact: ContactRecord | undefined;
  activities: ActivityRecord[];
  companyTasks: TaskRecord[];
};

const stageDefaultProbabilities: Record<DealRecord["stage"], number> = {
  Discovery: 10,
  Qualified: 30,
  Proposal: 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", options).format(date);
};

function DealProperties({ deal }: { deal: DealRecord }) {
  return <dl className={styles.properties}>
    <div><dt>Company</dt><dd>{deal.company}</dd></div>
    <div><dt>Stage</dt><dd>{deal.stage}</dd></div>
    <div><dt>Status</dt><dd><span className={`${styles.pill} ${styles[`status${deal.status}`]}`}>{deal.status}</span></dd></div>
    <div><dt>Amount</dt><dd>{formatCurrency(deal.amount)}</dd></div>
    <div><dt>Expected close</dt><dd><time dateTime={deal.expectedCloseDate}>{formatDate(deal.expectedCloseDate)}</time></dd></div>
    <div><dt>Owner</dt><dd>{deal.owner}</dd></div>
    <div><dt>Source</dt><dd>{deal.source}</dd></div>
    <div><dt>Stage-default probability</dt><dd>{stageDefaultProbabilities[deal.stage]}%</dd></div>
  </dl>;
}

function PrimaryContact({ contact }: { contact: ContactRecord | undefined }) {
  return <section aria-labelledby="primary-contact-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="primary-contact-heading">Primary contact</h2></div>
    {contact ? <div className={styles.contact}>
      <Link href={`/demo/contacts/${contact.id}`}>{contact.name}</Link>
      <span>{contact.jobTitle}</span>
      <span>{contact.company}</span>
    </div> : <p className={styles.empty} role="status">No matching contact is present in the sample records.</p>}
  </section>;
}

function ActivityTimeline({ activities }: { activities: ActivityRecord[] }) {
  return <section aria-labelledby="deal-activity-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="deal-activity-heading">Activity timeline</h2><span>{activities.length}</span></div>
    {activities.length ? <ol className={styles.activityList}>
      {activities.map((activity) => <li key={activity.id}>
        <div><strong>{activity.title}</strong><p>{activity.detail}</p></div>
        <time dateTime={activity.occurredAt}>{formatDate(activity.occurredAt)}</time>
      </li>)}
    </ol> : <p className={styles.empty} role="status">No sample activity references this deal.</p>}
  </section>;
}

function CompanyTasks({ tasks, company }: { tasks: TaskRecord[]; company: string }) {
  return <section aria-labelledby="company-tasks-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="company-tasks-heading">Company-related tasks</h2><span>{tasks.length}</span></div>
    <p className={styles.sectionNote}>Tasks related to {company}; they are not assigned to this deal.</p>
    {tasks.length ? <div className={styles.taskList}>
      {tasks.map((task) => <article key={task.id}>
        <div><strong>{task.title}</strong><span>{task.status} · {task.priority} priority</span></div>
        <time dateTime={task.dueAt}>{formatDate(task.dueAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric" })}</time>
      </article>)}
    </div> : <p className={styles.empty} role="status">No sample tasks are related to this company.</p>}
  </section>;
}

export function DemoDealDetail({ deal, contact, activities, companyTasks }: DemoDealDetailProps) {
  return <div className={styles.content}>
    <Link className={styles.backLink} href="/demo/deals"><ArrowLeft aria-hidden="true" size={16} />Back to deals</Link>
    <header className={styles.pageHeader}>
      <div><h1>{deal.title}</h1><p>{deal.company} · {deal.stage} · {formatCurrency(deal.amount)}</p></div>
      <span className={styles.sampleTag}>Fictional · read-only</span>
    </header>
    <p className={styles.probabilityNote}>Probability is the fictional sample’s stage default, not a user override or live CRM value.</p>
    <section aria-labelledby="deal-properties-heading" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="deal-properties-heading">Deal properties</h2></div>
      <DealProperties deal={deal} />
    </section>
    <PrimaryContact contact={contact} />
    <ActivityTimeline activities={activities} />
    <CompanyTasks company={deal.company} tasks={companyTasks} />
  </div>;
}
