"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { formatCurrency, type CompanyRecord, type ContactRecord, type DealRecord, type TaskRecord } from "@/lib/dashboard-data";
import styles from "./demo-contacts.module.css";

type DemoContactsProps = {
  contact: ContactRecord;
  company: CompanyRecord | undefined;
  deals: DealRecord[];
  companyTasks: TaskRecord[];
};

function DemoContactTable({ contacts }: { contacts: ContactRecord[] }) {
  return <div className={styles.tableScroll}><table className={styles.table}>
    <caption className={styles.srOnly}>Fictional demo contacts</caption>
    <thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Job title</th><th scope="col">Email</th><th scope="col">Phone</th></tr></thead>
    <tbody>{contacts.map((contact) => <tr key={contact.id}>
      <th scope="row"><Link href={`/demo/contacts/${contact.id}`}>{contact.name}</Link></th>
      <td>{contact.company}</td><td>{contact.jobTitle}</td><td>{contact.email}</td><td>{contact.phone}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function DemoContactsDirectory({ contacts }: { contacts: ContactRecord[] }) {
  const [query, setQuery] = useState("");
  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return contacts.filter((contact) =>
      `${contact.name} ${contact.company} ${contact.jobTitle} ${contact.email}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [contacts, query]);
  const countLabel = `${visibleContacts.length} ${visibleContacts.length === 1 ? "contact" : "contacts"}`;

  return <div className={styles.content}>
    <header className={styles.pageHeader}><div><h1>Contacts</h1><p>Search fictional people and open a read-only view of their sample records.</p></div><span className={styles.sampleTag}>Sample data</span></header>
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden="true" size={16} />
        <span className={styles.srOnly}>Search contacts</span>
        <input aria-label="Search contacts" onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, company, job title, or email" type="search" value={query} />
      </label>
      <span aria-live="polite" className={styles.resultCount}>{countLabel}</span>
    </div>
    <section aria-label="Contacts sample records" className={styles.panel}>
      {visibleContacts.length ? <DemoContactTable contacts={visibleContacts} /> : <p className={styles.empty} role="status">No fictional contacts match “{query.trim()}”. Try a name, company, job title, or email.</p>}
    </section>
  </div>;
}

function ContactFacts({ contact }: { contact: ContactRecord }) {
  return <dl className={styles.contactFacts}>
    <div><dt>Company</dt><dd>{contact.company}</dd></div>
    <div><dt>Job title</dt><dd>{contact.jobTitle}</dd></div>
    <div><dt>Email</dt><dd>{contact.email}</dd></div>
    <div><dt>Phone</dt><dd>{contact.phone}</dd></div>
  </dl>;
}

function CompanyFacts({ company }: { company: CompanyRecord | undefined }) {
  if (!company) return <p className={styles.empty}>No company record with this exact name is present in the sample.</p>;

  return <dl className={styles.companyFacts}>
    <div><dt>Industry</dt><dd>{company.industry}</dd></div>
    <div><dt>Company owner</dt><dd>{company.owner}</dd></div>
    <div><dt>Contacts in company record</dt><dd>{company.contactCount}</dd></div>
    <div><dt>Open pipeline</dt><dd>{formatCurrency(company.openPipeline)}</dd></div>
  </dl>;
}

function RelatedDeals({ deals }: { deals: DealRecord[] }) {
  return <section aria-labelledby="related-deals-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="related-deals-heading">Deals matching this contact</h2><span>{deals.length}</span></div>
    {deals.length ? <div className={styles.tableScroll}><table className={styles.table}>
      <caption className={styles.srOnly}>Fictional deals matched by exact contact name</caption>
      <thead><tr><th scope="col">Deal</th><th scope="col">Stage</th><th scope="col">Value</th><th scope="col">Status</th></tr></thead>
      <tbody>{deals.map((deal) => <tr key={deal.id}><th scope="row">{deal.title}</th><td>{deal.stage}</td><td>{formatCurrency(deal.amount)}</td><td>{deal.status}</td></tr>)}</tbody>
    </table></div> : <p className={styles.empty}>No deals in the sample match this contact’s exact name.</p>}
  </section>;
}

function CompanyTasks({ tasks }: { tasks: TaskRecord[] }) {
  return <section aria-labelledby="company-tasks-heading" className={styles.panel}>
    <div className={styles.sectionHeading}><h2 id="company-tasks-heading">Company-related tasks</h2><span>{tasks.length}</span></div>
    <p className={styles.sectionNote}>These tasks are related to the company, not assigned to this contact.</p>
    {tasks.length ? <div className={styles.tableScroll}><table className={styles.table}>
      <caption className={styles.srOnly}>Fictional tasks related to the contact’s company</caption>
      <thead><tr><th scope="col">Task</th><th scope="col">Due</th><th scope="col">Owner</th><th scope="col">Status</th></tr></thead>
      <tbody>{tasks.map((task) => <tr key={task.id}><th scope="row">{task.title}</th><td><time dateTime={task.dueAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(task.dueAt))}</time></td><td>{task.owner}</td><td>{task.status}</td></tr>)}</tbody>
    </table></div> : <p className={styles.empty}>No tasks in the sample are related to this company.</p>}
  </section>;
}

export function DemoContactDetail({ contact, company, deals, companyTasks }: DemoContactsProps) {
  return <div className={styles.content}>
    <Link className={styles.backLink} href="/demo/contacts"><ArrowLeft aria-hidden="true" size={16} />Back to contacts</Link>
    <header className={styles.pageHeader}>
      <div><h1>{contact.name}</h1><p>{contact.jobTitle} · {contact.company}</p></div>
      <span className={styles.sampleTag}>Fictional · read-only</span>
    </header>
    <section aria-labelledby="contact-facts-heading" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="contact-facts-heading">Contact facts</h2></div>
      <ContactFacts contact={contact} />
    </section>
    <section aria-labelledby="company-facts-heading" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="company-facts-heading">Company facts · exact name match</h2></div>
      <CompanyFacts company={company} />
    </section>
    <RelatedDeals deals={deals} />
    <CompanyTasks tasks={companyTasks} />
  </div>;
}
