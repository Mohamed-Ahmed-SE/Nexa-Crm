"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, Check, ChevronLeft, ChevronRight, Globe, Mail, Plus, Search, X } from "lucide-react";
import { addCompanyNoteAction, archiveCompanyAction, completeCompanyTaskAction, createCompanyAction, createCompanyTaskAction, logCompanyActivityAction, updateCompanyAction, uploadCompanyFileAction, type CompanyActionState } from "./actions";
import { type CompanyDetail, type CompanyListRow, type CompanyOwner } from "@/lib/companies/repository";
import { companyPageSize } from "@/lib/companies/schema";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate, formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

const emptyState: CompanyActionState = {};
const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const dateTime = (value: string | null, dateFormat: DateFormat) => value ? formatCalendarDateTime(value, dateFormat) : "—";
const dateOnly = (value: string | null, dateFormat: DateFormat) => value ? formatCalendarDate(value, dateFormat) : "No due date";
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join(""); }
function employeeBand(size: number | null) {
  if (size === null) return "Not specified";
  if (size <= 10) return "1–10 employees";
  if (size <= 50) return "11–50 employees";
  if (size <= 200) return "51–200 employees";
  if (size <= 500) return "201–500 employees";
  if (size <= 1000) return "501–1,000 employees";
  return "1,001+ employees";
}
function useRefreshOnSuccess(state: CompanyActionState, close?: () => void) {
  const router = useRouter();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => { if (state.ok) { closeRef.current?.(); router.refresh(); } }, [state.ok, router]);
}

export function CompaniesWorkspace({ companies, matchedCount, totalCount, owners, search, ownerId, page, canCreate, canImport, canExport, canEditAll, canEditOwn, currentUserId }: {
  companies: CompanyListRow[]; matchedCount: number; totalCount: number; owners: CompanyOwner[]; search: string; ownerId: string; page: number;
  canCreate: boolean; canImport: boolean; canExport: boolean; canEditAll: boolean; canEditOwn: boolean; currentUserId: string;
}) {
  const dateFormat = useDateFormat();
  const [formOpen, setFormOpen] = useState(false);
  const lastPage = Math.max(1, Math.ceil(matchedCount / companyPageSize));
  const canEdit = (company: CompanyListRow) => canEditAll || (canEditOwn && company.owner_id === currentUserId);
  return <main className="dashboard-page companies-page">
    <header className="leads-header">
      <div><h1>Companies</h1><p className="page-description">Organizations connected to your sales work.</p></div>
      <div className="entity-list-actions">{canExport && <a className="leads-secondary-button" href={filteredExportHref("companies", { q: search, owner: ownerId })}>Export CSV</a>}{canImport && <a className="leads-secondary-button" href="/app/data-import?entity=companies">Import CSV</a>}{canCreate && <button className="leads-primary-button" onClick={() => setFormOpen(true)} type="button"><Plus size={15} />Add company</button>}</div>
    </header>
    <section aria-label="Company list" className="leads-panel">
      <form action="/app/companies" className="leads-toolbar" role="search">
        <label className="companies-search"><Search aria-hidden="true" size={16} /><input aria-label="Search companies" defaultValue={search} name="q" placeholder="Search company, industry, domain, contact" /></label>
        <label className="leads-filter"><span className="sr-only">Filter by owner</span><select aria-label="Filter by owner" defaultValue={ownerId} name="owner"><option value="">All owners</option><option value="unassigned">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>
        <button className="leads-secondary-button" type="submit">Search</button>
      </form>
      <div className="companies-table-wrap"><table className="leads-table companies-table"><thead><tr><th scope="col">Company</th><th scope="col">Industry</th><th scope="col">Contacts</th><th scope="col">Open deals</th><th scope="col">Pipeline value</th><th scope="col">Owner</th><th scope="col">Last activity</th><th scope="col">Next activity</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{companies.map((company) => <tr key={company.id}>
          <td><div className="company-name-cell"><span aria-hidden="true" className="company-initials">{initials(company.name)}</span><div><Link href={`/app/companies/${company.id}`}><strong>{company.name}</strong></Link><small>{company.website?.replace(/^https?:\/\//, "") || "—"}</small></div></div></td>
          <td>{company.industry || "—"}</td><td>{company.contactsCount}</td><td>{company.openDealsCount}</td>
          <td className="leads-amount">{company.openDealsCount ? company.currency ? money(company.openPipelineValue, company.currency) : "Multiple currencies" : "—"}</td><td>{company.ownerLabel}</td>
          <td>{company.lastActivity ? <time dateTime={company.lastActivity}>{dateOnly(company.lastActivity, dateFormat)}</time> : "—"}</td><td>{company.nextActivity ? <time dateTime={company.nextActivity}>{dateOnly(company.nextActivity, dateFormat)}</time> : "—"}</td>
          <td className="leads-row-action">{canEdit(company) ? <Link className="leads-edit-button" href={`/app/companies/${company.id}?edit=1`}>Edit</Link> : <span className="leads-read-only">View</span>}</td>
        </tr>)}</tbody></table></div>
      {companies.length === 0 ? <div className="leads-empty"><Building2 aria-hidden="true" size={22} /><h2>{totalCount === 0 ? "No companies yet" : "No matching companies"}</h2><p>{totalCount === 0 ? "Add a company to keep its people and sales activity together." : "Try a different search or owner filter."}</p>{canCreate && totalCount === 0 && <button className="leads-secondary-button" onClick={() => setFormOpen(true)} type="button"><Plus size={14} />Add company</button>}</div> : <nav aria-label="Company pages" className="leads-pagination"><span>{matchedCount ? `${(page - 1) * companyPageSize + 1}–${Math.min(page * companyPageSize, matchedCount)} of ${matchedCount}` : "0 results"}</span><div><Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={companyHref(search, ownerId, Math.max(1, page - 1))} aria-label="Previous page"><ChevronLeft size={16} />Previous</Link><Link aria-disabled={page >= lastPage} className={page >= lastPage ? "is-disabled" : ""} href={companyHref(search, ownerId, Math.min(lastPage, page + 1))} aria-label="Next page">Next<ChevronRight size={16} /></Link></div></nav>}
    </section>
    {formOpen && <CompanyForm owners={owners} onClose={() => setFormOpen(false)} />}
  </main>;
}

function companyHref(search: string, owner: string, page: number) {
  const params = new URLSearchParams(); if (search) params.set("q", search); if (owner) params.set("owner", owner); if (page > 1) params.set("page", String(page));
  return `/app/companies${params.size ? `?${params.toString()}` : ""}`;
}

function ArchiveConfirmation({ company, state, action, pending, onClose }: { company: CompanyDetail["company"]; state: CompanyActionState; action: (form: FormData) => void; pending: boolean; onClose: () => void }) {
  const { dialogRef, onKeyDown } = useCompanyDialog(onClose, pending);
  return <div className="leads-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section ref={dialogRef} aria-describedby="archive-company-description" aria-labelledby="archive-company-title" aria-modal="true" className="company-confirm-dialog" onKeyDown={onKeyDown} role="alertdialog" tabIndex={-1}><h2 id="archive-company-title">Archive {company.name}?</h2><p id="archive-company-description">It will be removed from the active company list. Related records will remain in the workspace.</p><form action={action}><input name="id" type="hidden" value={company.id} />{state.message && <p aria-live="polite" className="contact-form-error">{state.message}</p>}<footer className="leads-form-footer"><button className="leads-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Archiving…" : "Archive company"}</button></footer></form></section></div>;
}

function useCompanyDialog(onClose: () => void, pending: boolean) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]")?.focus();
    return () => opener?.focus();
  }, []);
  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) closeRef.current();
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]");
    if (!controls?.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return { dialogRef, onKeyDown };
}

function CompanyForm({ owners, company, canReassign, onClose }: { owners: CompanyOwner[]; company?: CompanyDetail["company"]; canReassign?: boolean; onClose: () => void }) {
  const action = company ? updateCompanyAction : createCompanyAction;
  const [state, formAction, pending] = useActionState(action, emptyState);
  useRefreshOnSuccess(state, onClose);
  const errors = state.fieldErrors ?? {};
  const { dialogRef, onKeyDown } = useCompanyDialog(onClose, pending);
  return <div className="leads-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <section ref={dialogRef} aria-describedby="company-form-description" aria-labelledby="company-form-title" aria-modal="true" className="leads-dialog" onKeyDown={onKeyDown} role="dialog" tabIndex={-1}>
      <header className="leads-dialog-header"><div><h2 id="company-form-title">{company ? "Edit company" : "Add company"}</h2><p id="company-form-description">{company ? "Update this company’s workspace details." : "Add an organization to this workspace."}</p></div><button aria-label="Close" className="leads-icon-button" disabled={pending} onClick={onClose} type="button"><X size={17} /></button></header>
      <form action={formAction} className="leads-form">
        {company && <input name="id" type="hidden" value={company.id} />}
        <Field error={errors.name?.[0]} label="Company name" name="name" required defaultValue={company?.name ?? ""} />
        <div className="leads-form-grid"><Field error={errors.website?.[0]} label="Website" name="website" placeholder="https://example.com" defaultValue={company?.website ?? ""} /><Field error={errors.industry?.[0]} label="Industry" name="industry" defaultValue={company?.industry ?? ""} /></div>
        <div className="leads-form-grid"><Field error={errors.employeeSize?.[0]} label="Employee count" name="employeeSize" type="number" min="0" defaultValue={company?.employee_size ?? ""} /><Field error={errors.phone?.[0]} label="Phone" name="phone" type="tel" defaultValue={company?.phone ?? ""} /></div>
        <div className="leads-form-grid"><Field error={errors.addressLine1?.[0]} label="Address" name="addressLine1" defaultValue={company?.address_line_1 ?? ""} /><Field error={errors.addressLine2?.[0]} label="Address line 2" name="addressLine2" defaultValue={company?.address_line_2 ?? ""} /></div>
        <div className="leads-form-grid"><Field error={errors.city?.[0]} label="City" name="city" defaultValue={company?.city ?? ""} /><Field error={errors.state?.[0]} label="State / region" name="state" defaultValue={company?.state ?? ""} /></div>
        <div className="leads-form-grid"><Field error={errors.postalCode?.[0]} label="Postal code" name="postalCode" defaultValue={company?.postal_code ?? ""} /><Field error={errors.country?.[0]} label="Country" name="country" defaultValue={company?.country ?? ""} /></div>
        <label className="leads-field"><span>Description</span><textarea name="description" defaultValue={company?.description ?? ""} />{errors.description?.[0] && <small>{errors.description[0]}</small>}</label>
        {canReassign ? <label className="leads-field"><span>Owner</span><select defaultValue={company?.owner_id ?? ""} name="ownerId"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label> : company ? <><input name="ownerId" type="hidden" value={company.owner_id ?? ""} /><label className="leads-field"><span>Owner</span><input readOnly value={owners.find((owner) => owner.id === company.owner_id)?.label ?? "Assigned to you"} /></label></> : <input name="ownerId" type="hidden" value="" />}
        {!company && state.duplicateMatches?.length ? <>
          <input name="confirmDuplicate" type="hidden" value="true" />
          <div aria-live="polite" className="csv-import-warning" role="status">
            <p>These active companies may be duplicates based on their name or website:</p>
            <ul>{state.duplicateMatches.map((match) => <li key={match.id}><strong>{match.name}</strong>{match.website && ` · ${match.website}`}</li>)}</ul>
            <p>Review the matches, edit the company details, or continue if this is a different company.</p>
          </div>
        </> : null}
        {state.message && <p aria-live="polite" className="contact-form-error">{state.message}</p>}
        <footer className="leads-form-footer"><button className="leads-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : company ? "Save changes" : state.duplicateMatches?.length ? "Add company anyway" : "Add company"}</button></footer>
      </form>
    </section>
  </div>;
}

function Field({ label, name, type = "text", defaultValue, required = false, placeholder, error, min }: { label: string; name: string; type?: string; defaultValue: string | number; required?: boolean; placeholder?: string; error?: string; min?: string }) {
  return <label className="leads-field"><span>{label}{required && <em>Required</em>}</span><input aria-invalid={Boolean(error)} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} min={min} />{error && <small>{error}</small>}</label>;
}

export function CompanyDetailWorkspace({ detail, owners, section, canEdit, canReassign, canArchive, currentUserId, startEditing = false }: { detail: CompanyDetail; owners: CompanyOwner[]; section: string; canEdit: boolean; canReassign: boolean; canArchive: boolean; currentUserId: string; startEditing?: boolean }) {
  const dateFormat = useDateFormat();
  const { company, contacts, deals, activities, tasks, notes, attachments } = detail;
  const [editing, setEditing] = useState(startEditing);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const router = useRouter();
  const [archiveState, archiveAction, archiving] = useActionState(archiveCompanyAction, emptyState);
  const [doneState, doneAction, completing] = useActionState(completeCompanyTaskAction, emptyState);
  useEffect(() => { if (archiveState.ok) router.push("/app/companies"); }, [archiveState.ok, router]);
  useRefreshOnSuccess(doneState);
  const openDeals = deals.filter((deal) => deal.status === "open");
  const currencies = new Set(openDeals.map((deal) => deal.currency));
  const valueCurrency = currencies.size === 1 ? openDeals[0].currency : null;
  const openValue = valueCurrency ? openDeals.reduce((sum, deal) => sum + Number(deal.amount), 0) : 0;
  const companyOwnerLabel = owners.find((owner) => owner.id === company.owner_id)?.label ?? detail.ownerLabel;
  const lastActivity = activities[0]?.occurred_at ?? null;
  const nextTask = tasks.find((task) => task.status === "open" && task.due_at && new Date(task.due_at).getTime() >= Date.now());
  const tabNames = ["Overview", "Contacts", "Deals", "Activity", "Tasks", "Notes", "Files"];
  const normalizedSection = tabNames.find((name) => name.toLowerCase() === section.toLowerCase()) ?? "Overview";
  const keyContacts = contacts.filter((contact) => contact.job_title || contact.email).slice(0, 4);
  return <main className="dashboard-page companies-page">
    <Link className="contact-breadcrumb" href="/app/companies"><ArrowLeft size={14} />Companies</Link>
    <header className="contact-hero company-hero"><span aria-hidden="true" className="contact-initials">{initials(company.name)}</span><div className="contact-hero-copy"><div className="company-heading-row"><h1>{company.name}</h1>{company.archived_at && <span className="leads-status">Archived</span>}</div><p>{company.website ? <a href={company.website} rel="noreferrer" target="_blank"><Globe size={13} />{company.website.replace(/^https?:\/\//, "")}</a> : <span><Globe size={13} />No website</span>}<span>{company.industry || "Industry not specified"}</span><span>{employeeBand(company.employee_size)}</span><span>{companyOwnerLabel}</span></p></div><div className="contact-header-actions">{canEdit && <button className="leads-secondary-button" onClick={() => setEditing(true)} type="button">Edit company</button>}{canArchive && !company.archived_at && <button className="leads-secondary-button" onClick={() => setConfirmArchive(true)} type="button">Archive</button>}</div></header>
    <section aria-label="Company summary" className="company-metrics"><Metric label="Open deal value" value={!openDeals.length ? "—" : valueCurrency ? money(openValue, valueCurrency) : "Multiple currencies"} /><Metric label="Contacts" value={String(contacts.length)} /><Metric label="Active deals" value={String(openDeals.length)} /><Metric label="Last activity" value={lastActivity ? dateOnly(lastActivity, dateFormat) : "—"} /></section>
    <nav aria-label="Company sections" className="contact-tabs">{tabNames.map((tab) => <Link aria-current={normalizedSection === tab ? "page" : undefined} className={normalizedSection === tab ? "is-active" : ""} href={`/app/companies/${company.id}?section=${tab.toLowerCase()}`} key={tab}>{tab}{tab === "Contacts" ? ` · ${contacts.length}` : tab === "Deals" ? ` · ${deals.length}` : tab === "Tasks" ? ` · ${tasks.length}` : ""}</Link>)}</nav>
    <div className="contact-detail-grid"><div className="contact-detail-main">{normalizedSection === "Overview" && <>
      <section className="contact-section"><SectionTitle title="Company overview" /><p className="company-description">{company.description || "No description has been added."}</p><dl className="company-property-grid"><Property label="Website" value={company.website} /><Property label="Phone" value={company.phone} /><Property label="Industry" value={company.industry} /><Property label="Employee band" value={employeeBand(company.employee_size)} /><Property label="Location" value={[company.city, company.state, company.country].filter(Boolean).join(", ") || null} /><Property label="Owner" value={companyOwnerLabel} /></dl></section>
      <section className="contact-section"><SectionTitle title="Recent activity" />{activities.length ? <ActivityList activities={activities.slice(0, 5)} dateFormat={dateFormat} /> : <EmptyDetail text="No company activity has been recorded." />}</section>
      <section className="contact-section"><SectionTitle title="Open tasks" />{tasks.some((task) => task.status === "open") ? <TaskList tasks={tasks.filter((task) => task.status === "open").slice(0, 5)} companyId={company.id} canComplete={canEdit} currentUserId={currentUserId} action={doneAction} pending={completing} dateFormat={dateFormat} /> : <EmptyDetail text="No open tasks for this company." />}</section>
    </>}
    {normalizedSection === "Contacts" && <section className="contact-section"><SectionTitle title="Contacts" />{contacts.length ? <ul className="company-record-list">{contacts.map((contact) => <li key={contact.id}><span aria-hidden="true" className="company-initials company-small-initials">{initials(`${contact.first_name} ${contact.last_name}`)}</span><div><Link href={`/app/contacts/${contact.id}`}><strong>{contact.first_name} {contact.last_name}</strong></Link><small>{contact.job_title || contact.email || "Contact"}</small></div>{contact.email && <a aria-label={`Email ${contact.first_name} ${contact.last_name}`} href={`mailto:${contact.email}`}><Mail size={15} /></a>}</li>)}</ul> : <EmptyDetail text="No contacts are linked to this company." />}</section>}
    {normalizedSection === "Deals" && <section className="contact-section"><SectionTitle title="Deals" />{deals.length ? <ul className="company-record-list">{deals.map((deal) => <li key={deal.id}><div><strong>{deal.title}</strong><small>{deal.stage?.name ?? deal.status} · {deal.expected_close_date ? dateOnly(deal.expected_close_date, dateFormat) : "No close date"}</small></div><span>{money(Number(deal.amount), deal.currency)}</span></li>)}</ul> : <EmptyDetail text="No deals are linked to this company." />}</section>}
    {normalizedSection === "Activity" && <><section className="contact-section"><SectionTitle title="Activity" />{activities.length ? <ActivityList activities={activities} dateFormat={dateFormat} /> : <EmptyDetail text="No company activity has been recorded." />}</section>{canEdit && <EngagementForm companyId={company.id} kind="activity" />}</>}
    {normalizedSection === "Tasks" && <><section className="contact-section"><SectionTitle title="Tasks" />{tasks.length ? <TaskList tasks={tasks} companyId={company.id} canComplete={canEdit} currentUserId={currentUserId} action={doneAction} pending={completing} dateFormat={dateFormat} /> : <EmptyDetail text="No tasks are linked to this company." />}</section>{canEdit && <EngagementForm companyId={company.id} kind="task" owners={owners} canReassign={canReassign} currentUserId={currentUserId} />}</>}
    {normalizedSection === "Notes" && <><section className="contact-section"><SectionTitle title="Notes" />{notes.length ? <ul className="company-notes">{notes.map((note) => <li key={note.id}><p>{note.body}</p><time dateTime={note.created_at}>{dateTime(note.created_at, dateFormat)}</time></li>)}</ul> : <EmptyDetail text="No notes have been added." />}</section>{canEdit && <EngagementForm companyId={company.id} kind="note" />}</>}
    {normalizedSection === "Files" && <section className="contact-section"><SectionTitle title="Files" />{attachments.length ? <ul className="contact-file-list">{attachments.map((file) => <li key={file.id}><div><strong>{file.filename}</strong><small>{(file.size_bytes / 1024).toFixed(0)} KB · {dateOnly(file.created_at, dateFormat)}</small></div><Link className="leads-secondary-button" href={`/app/companies/files/${file.id}`}>Download</Link></li>)}</ul> : <EmptyDetail text="No files have been uploaded." />}{canEdit && <FileUpload companyId={company.id} />}</section>}
    </div>
    <aside aria-label="Company details" className="contact-detail-rail"><section className="contact-rail-section"><SectionTitle title="Company properties" /><dl className="company-rail-properties"><Property label="Industry" value={company.industry} /><Property label="Employees" value={employeeBand(company.employee_size)} /><Property label="Phone" value={company.phone} /><Property label="Address" value={[company.address_line_1, company.address_line_2, company.city, company.state, company.postal_code, company.country].filter(Boolean).join(", ") || null} /><Property label="Website" value={company.website} /></dl></section><section className="contact-rail-section"><SectionTitle title="Key contacts" />{keyContacts.length ? <ul className="company-key-contacts">{keyContacts.map((contact) => <li key={contact.id}><Link href={`/app/contacts/${contact.id}`}><strong>{contact.first_name} {contact.last_name}</strong><small>{contact.job_title || contact.email}</small></Link></li>)}</ul> : <EmptyDetail text="No key contacts available." />}</section><section className="contact-rail-section"><SectionTitle title="Next task" />{nextTask ? <div className="company-next-task"><strong>{nextTask.title}</strong><span><CalendarClock size={14} />{dateTime(nextTask.due_at, dateFormat)}</span></div> : <EmptyDetail text="No upcoming tasks." />}</section></aside></div>
    {editing && <CompanyForm company={company} owners={owners} canReassign={canReassign} onClose={() => setEditing(false)} />}
    {confirmArchive && <ArchiveConfirmation company={company} state={archiveState} action={archiveAction} pending={archiving} onClose={() => setConfirmArchive(false)} />}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function SectionTitle({ title }: { title: string }) { return <header className="contact-section-heading"><h2>{title}</h2></header>; }
function Property({ label, value }: { label: string; value: string | null }) { return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>; }
function EmptyDetail({ text }: { text: string }) { return <p className="company-empty-detail">{text}</p>; }
function ActivityList({ activities, dateFormat }: { activities: CompanyDetail["activities"]; dateFormat: DateFormat }) { return <ol className="company-activity-list">{activities.map((activity) => <li key={activity.id}><span aria-hidden="true" className="company-activity-dot" /><div><strong>{activity.subject || activity.activity_type}</strong>{activity.body && <p>{activity.body}</p>}<time dateTime={activity.occurred_at}>{dateTime(activity.occurred_at, dateFormat)} · {activity.activity_type}</time></div></li>)}</ol>; }
function TaskList({ tasks, companyId, canComplete, currentUserId, action, pending, dateFormat }: { tasks: CompanyDetail["tasks"]; companyId: string; canComplete: boolean; currentUserId: string; action: (form: FormData) => void; pending: boolean; dateFormat: DateFormat }) {
  return <ul className="contact-task-list company-task-list">{tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><small>{task.priority} priority · {dateOnly(task.due_at, dateFormat)}</small>{task.description && <p>{task.description}</p>}</div>{task.status === "open" && (canComplete || task.assigned_to === currentUserId) && <form action={action}><input name="taskId" type="hidden" value={task.id} /><input name="companyId" type="hidden" value={companyId} /><button aria-label={`Complete ${task.title}`} className="leads-icon-button" disabled={pending} type="submit"><Check size={14} /></button></form>}<span className="leads-status">{task.status}</span></li>)}</ul>;
}
function localDateTimeInput(dateTime: Date) { return new Date(dateTime.getTime() - dateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function captureCompanyTimezoneOffset(event: React.FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const formData = new FormData(form);
  const localDateTime = formData.get("occurredAt") ?? formData.get("dueAt");
  const offset = form.elements.namedItem("timezoneOffset");
  if (typeof localDateTime === "string" && offset instanceof HTMLInputElement) offset.value = String(new Date(localDateTime).getTimezoneOffset());
}
function EngagementForm({ companyId, kind, owners = [], canReassign = false, currentUserId }: { companyId: string; kind: "activity" | "task" | "note"; owners?: CompanyOwner[]; canReassign?: boolean; currentUserId?: string }) {
  const action = kind === "activity" ? logCompanyActivityAction : kind === "task" ? createCompanyTaskAction : addCompanyNoteAction;
  const [state, formAction, pending] = useActionState(action, emptyState);
  useRefreshOnSuccess(state);
  const title = kind === "activity" ? "Log activity" : kind === "task" ? "Add task" : "Add note";
  return <section className="contact-section company-engagement"><SectionTitle title={title} /><form action={formAction} className="leads-form company-inline-form" onSubmit={captureCompanyTimezoneOffset}><input name="companyId" type="hidden" value={companyId} /><input name="timezoneOffset" type="hidden" value="" />
    {kind === "activity" && <><label className="leads-field"><span>Activity type</span><select name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select></label><Field label="Subject" name="subject" required defaultValue="" /><label className="leads-field"><span>When</span><input name="occurredAt" required type="datetime-local" defaultValue={localDateTimeInput(new Date())} /></label><label className="leads-field"><span>Details</span><textarea name="body" /></label></>}
    {kind === "task" && <><Field label="Task title" name="title" required defaultValue="" /><div className="leads-form-grid"><label className="leads-field"><span>Type</span><select name="type"><option value="to_do">To-do</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option></select></label><label className="leads-field"><span>Priority</span><select name="priority"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option></select></label></div><label className="leads-field"><span>Due at</span><input name="dueAt" required type="datetime-local" defaultValue={localDateTimeInput(new Date(Date.now() + 86_400_000))} /></label>{canReassign ? <label className="leads-field"><span>Assigned to</span><select name="assignedTo" defaultValue={currentUserId}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label> : <input name="assignedTo" type="hidden" value={currentUserId ?? ""} />}<label className="leads-field"><span>Description</span><textarea name="description" /></label></>}
    {kind === "note" && <label className="leads-field"><span>Note</span><textarea name="body" required /></label>}
    {state.message && <p aria-live="polite" className="contact-form-error">{state.message}</p>}<button className="leads-primary-button" disabled={pending} type="submit"><Plus size={14} />{pending ? "Saving…" : title}</button></form></section>;
}
function filteredExportHref(entity: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") params.set(key, value);
  return `/app/${entity}/export${params.size ? `?${params.toString()}` : ""}`;
}

function FileUpload({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState(uploadCompanyFileAction, emptyState);
  useRefreshOnSuccess(state);
  return <form action={formAction} className="company-file-upload"><input name="companyId" type="hidden" value={companyId} /><label className="leads-field"><span>Choose a file (PDF, text, CSV, DOCX, XLSX, or PPTX; up to 10 MB)</span><input accept=".pdf,.txt,.csv,.docx,.xlsx,.pptx" name="file" required type="file" /></label><button className="leads-secondary-button" disabled={pending} type="submit"><Plus size={14} />{pending ? "Uploading…" : "Upload file"}</button>{state.message && <p aria-live="polite" className="contact-form-error">{state.message}</p>}</form>;
}
