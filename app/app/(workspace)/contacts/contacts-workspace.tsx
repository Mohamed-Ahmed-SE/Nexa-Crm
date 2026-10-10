"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Mail, Phone, Plus, X } from "lucide-react";
import { addContactNoteAction, completeContactTaskAction, createContactAction, createContactTaskAction, logContactActivityAction, updateContactAction, uploadContactFileAction, type ContactActionState } from "./actions";
import { type ContactActivity, type ContactAttachment, type ContactCompany, type ContactDeal, type ContactListRow, type ContactNote, type ContactOwner, type ContactRow, type ContactTask } from "@/lib/contacts/repository";
import { contactPageSize, contactViewColumns, contactViewSorts, lifecycleLabels, type ContactViewColumn, type ContactViewSort } from "@/lib/contacts/schema";
import type { ContactSavedView } from "@/lib/contacts/repository";
import { deleteContactViewAction, saveContactViewAction, type ContactSavedViewActionState } from "./saved-view-actions";
import { useCreateIntent } from "../use-create-intent";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate, formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

const blank: ContactActionState = {};
type CompanyOption = Pick<ContactCompany, "id" | "name" | "archived_at">;
const contactColumnLabels: Record<ContactViewColumn, string> = {
  name: "Name", company: "Company", job_title: "Job title", email: "Email", phone: "Phone",
  owner: "Owner", lifecycle: "Lifecycle", last_activity: "Last Activity", next_activity: "Next Activity", tags: "Tags",
};
const contactSortLabels: Record<ContactViewSort, string> = {
  updated_desc: "Recently updated", updated_asc: "Least recently updated", created_desc: "Recently created",
  created_asc: "Least recently created", name_asc: "Name A–Z", name_desc: "Name Z–A",
};
function clearSelectedView(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
  const selectedView = event.currentTarget.form?.elements.namedItem("view");
  if (selectedView instanceof HTMLSelectElement) selectedView.value = "";
}
type ContactFormData = { companies: CompanyOption[]; owners: ContactOwner[]; canReassign: boolean; contact?: ContactRow; onClose: () => void };
type DialogKind = "contact" | "activity" | "note" | "task";

function useDone(state: ContactActionState, close: () => void) {
  const router = useRouter();
  useEffect(() => { if (state.ok) { close(); router.refresh(); } }, [state.ok, close, router]);
}

function ContactForm({ companies, owners, canReassign, contact, onClose }: ContactFormData) {
  const action = contact ? updateContactAction : createContactAction;
  const [state, formAction, pending] = useActionState(action, blank);
  useDone(state, onClose);
  const errors = state.fieldErrors ?? {};
  return <Dialog title={contact ? "Edit contact" : "Add contact"} description={contact ? "Update this contact’s workspace details." : "Add a contact to this workspace."} onClose={onClose} pending={pending}>
    <form action={formAction} className="leads-form">
      {contact && <input name="id" type="hidden" value={contact.id} />}
      <div className="leads-form-grid"><Field label="First name" name="firstName" required error={errors.firstName?.[0]} defaultValue={contact?.first_name ?? ""} /><Field label="Last name" name="lastName" required error={errors.lastName?.[0]} defaultValue={contact?.last_name ?? ""} /></div>
      <div className="leads-form-grid"><Field label="Email" name="email" type="email" error={errors.email?.[0]} defaultValue={contact?.email ?? ""} /><Field label="Phone" name="phone" type="tel" error={errors.phone?.[0]} defaultValue={contact?.phone ?? ""} /></div>
      <div className="leads-form-grid"><Field label="Job title" name="jobTitle" error={errors.jobTitle?.[0]} defaultValue={contact?.job_title ?? ""} /><label className="leads-field"><span>Company</span><select defaultValue={contact?.company_id ?? ""} name="companyId"><option value="">No company</option>{contact?.company_id && !companies.some((company) => company.id === contact.company_id) && <option value={contact.company_id}>Current company (archived — retained)</option>}{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>{errors.companyId?.[0] && <small>{errors.companyId[0]}</small>}</label></div>
      <div className="leads-form-grid"><label className="leads-field"><span>Lifecycle</span><select defaultValue={contact?.lifecycle_status ?? "active"} name="lifecycleStatus">{Object.entries(lifecycleLabels).map(([lifecycleStatus, label]) => <option key={lifecycleStatus} value={lifecycleStatus}>{label}</option>)}</select>{errors.lifecycleStatus?.[0] && <small>{errors.lifecycleStatus[0]}</small>}</label>{canReassign ? <label className="leads-field"><span>Owner</span><select defaultValue={contact?.owner_id ?? ""} name="ownerId"><option value="">Unassigned</option>{contact?.owner_id && !owners.some((owner) => owner.id === contact.owner_id) && <option value={contact.owner_id}>Current owner (inactive — retained)</option>}{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select>{errors.ownerId?.[0] && <small>{errors.ownerId[0]}</small>}</label> : <input name="ownerId" type="hidden" value={contact?.owner_id ?? ""} />}</div>
      <Field label="LinkedIn URL" name="linkedinUrl" type="url" error={errors.linkedinUrl?.[0]} defaultValue={contact?.linkedin_url ?? ""} />
      {!contact && state.duplicateMatches && state.duplicateMatches.length > 0 && <>
        <input name="confirmDuplicate" type="hidden" value="true" />
        <div aria-live="polite" className="csv-import-warning" role="status">
          <p>Another active contact matches this email or phone:</p>
          <ul>{state.duplicateMatches.map((match) => <li key={`${match.name}-${match.companyName ?? ""}`}><strong>{match.name}</strong>{match.companyName && ` · ${match.companyName}`}</li>)}</ul>
          <p>You can still continue if this is a different person.</p>
        </div>
      </>}
      {state.message && <p aria-live="polite" className="leads-form-message">{state.message}</p>}
      <footer className="leads-form-footer"><button className="leads-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : contact ? "Save changes" : state.duplicateMatches?.length ? "Add contact anyway" : "Add contact"}</button></footer>
    </form>
  </Dialog>;
}

function EngagementForm({ kind, contactId, owners, canReassign, onClose }: { kind: Exclude<DialogKind, "contact">; contactId: string; owners: ContactOwner[]; canReassign: boolean; onClose: () => void }) {
  const action = kind === "activity" ? logContactActivityAction : kind === "note" ? addContactNoteAction : createContactTaskAction;
  const [state, formAction, pending] = useActionState(action, blank);
  useDone(state, onClose);
  const title = kind === "activity" ? "Log activity" : kind === "note" ? "Add note" : "Add task";
  return <Dialog title={title} description="This record will be linked to the contact." onClose={onClose} pending={pending}>
    <form action={formAction} className="leads-form" onSubmit={captureLocalTimezoneOffset}>
      <input name="contactId" type="hidden" value={contactId} />
      <input name="timezoneOffset" type="hidden" value="" />
      {kind === "activity" && <><label className="leads-field"><span>Activity type</span><select defaultValue="call" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select></label><Field label="Subject" name="subject" required /><label className="leads-field"><span>Description</span><textarea name="body" rows={4} /></label><Field label="Occurred at" name="occurredAt" required type="datetime-local" defaultValue={localDateTimeInput(new Date())} /></>}
      {kind === "note" && <label className="leads-field"><span>Note</span><textarea autoFocus maxLength={10000} name="body" required rows={6} /></label>}
      {kind === "task" && <><Field label="Task title" name="title" required /><div className="leads-form-grid"><label className="leads-field"><span>Type</span><select defaultValue="follow_up" name="type"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option><option value="to_do">To-do</option></select></label><label className="leads-field"><span>Priority</span><select defaultValue="medium" name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>{canReassign && <label className="leads-field"><span>Assign to</span><select defaultValue="" name="assignedTo"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>}<label className="leads-field"><span>Description</span><textarea name="description" rows={3} /></label><Field label="Due at" name="dueAt" required type="datetime-local" defaultValue={localDateTimeInput(new Date(Date.now() + 86400000))} /></>}
      {state.message && <p aria-live="polite" className="leads-form-message">{state.message}</p>}
      <footer className="leads-form-footer"><button className="leads-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : kind === "activity" ? "Log activity" : kind === "note" ? "Add note" : "Add task"}</button></footer>
    </form>
  </Dialog>;
}

function Dialog({ title, description, onClose, pending, children }: { title: string; description: string; onClose: () => void; pending: boolean; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]")?.focus();
    return () => opener?.focus();
  }, []);
  function keepFocusInDialog(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) onClose();
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]");
    if (!controls?.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div className="leads-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section ref={dialogRef} aria-labelledby="contact-dialog-title" aria-modal="true" className="leads-dialog" onKeyDown={keepFocusInDialog} role="dialog" tabIndex={-1}><header className="leads-dialog-header"><div><h2 id="contact-dialog-title">{title}</h2><p>{description}</p></div><button aria-label="Close dialog" className="leads-icon-button" disabled={pending} onClick={onClose} type="button"><X size={17} /></button></header>{children}</section></div>;
}

function Field({ label, name, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string }) {
  return <label className="leads-field"><span>{label}{props.required && <b aria-hidden="true"> *</b>}</span><input aria-invalid={Boolean(error)} name={name} {...props} />{error && <small>{error}</small>}</label>;
}

function ownerName(ownerId: string | null, owners: ContactOwner[]) { return ownerId ? owners.find((owner) => owner.id === ownerId)?.label ?? `Workspace member · ${ownerId.slice(0, 6)}` : "Unassigned"; }
function fullName(contact: Pick<ContactRow, "first_name" | "last_name">) { return `${contact.first_name} ${contact.last_name}`.trim(); }
function initials(contact: Pick<ContactRow, "first_name" | "last_name">) { return `${contact.first_name.trim().slice(0, 1)}${contact.last_name.trim().slice(0, 1)}`.toUpperCase(); }
function localDateTimeInput(dateTime: Date) { return new Date(dateTime.getTime() - dateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function captureLocalTimezoneOffset(event: React.FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const formData = new FormData(form);
  const localDateTime = formData.get("occurredAt") ?? formData.get("dueAt");
  const timezoneOffsetInput = form.elements.namedItem("timezoneOffset");
  if (typeof localDateTime === "string" && timezoneOffsetInput instanceof HTMLInputElement) timezoneOffsetInput.value = String(new Date(localDateTime).getTimezoneOffset());
}
function formatContactDateTime(dateTime: string | null, dateFormat: DateFormat) { return dateTime ? formatCalendarDateTime(dateTime, dateFormat) : "No due date"; }
function formatContactDate(date: string, dateFormat: DateFormat) { return formatCalendarDate(date, dateFormat); }
function lifecycleClass(lifecycleStatus: string) { return `contact-lifecycle lifecycle-${lifecycleStatus}`; }

function SavedContactViewControls({ search, lifecycle, companyId, ownerId, sort, visibleColumns, activeViewId }: {
  search: string; lifecycle: string; companyId: string; ownerId: string; sort: ContactViewSort;
  visibleColumns: ContactViewColumn[]; activeViewId: string;
}) {
  const router = useRouter();
  const emptyState: ContactSavedViewActionState = {};
  const [saveState, saveAction, saving] = useActionState(saveContactViewAction, emptyState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteContactViewAction, emptyState);
  useEffect(() => { if (saveState.ok || deleteState.ok) router.refresh(); }, [saveState.ok, deleteState.ok, router]);
  return <section aria-label="Saved contact views" className="leads-view-controls">
    <form action={saveAction} className="leads-view-save">
      <label className="leads-field"><span>Save current view</span><input maxLength={80} name="name" placeholder="View name" required /></label>
      <input name="q" type="hidden" value={search} /><input name="lifecycle" type="hidden" value={lifecycle} />
      <input name="companyId" type="hidden" value={companyId} /><input name="ownerId" type="hidden" value={ownerId} />
      <input name="sort" type="hidden" value={sort} />
      <fieldset><legend>Visible columns</legend>{contactViewColumns.map((column) => <label key={column}>
        <input defaultChecked={visibleColumns.includes(column)} name="visibleColumns" type="checkbox" value={column} />{contactColumnLabels[column]}
      </label>)}</fieldset>
      <button className="leads-secondary-button" disabled={saving} type="submit">{saving ? "Saving…" : "Save view"}</button>
      {saveState.message && <p aria-live="polite" className="leads-form-message">{saveState.message}</p>}
    </form>
    {activeViewId && <form action={deleteAction} className="leads-view-delete">
      <input name="id" type="hidden" value={activeViewId} />
      <button className="leads-secondary-button" disabled={deleting} type="submit">{deleting ? "Deleting…" : "Delete this view"}</button>
      {deleteState.message && <p aria-live="polite" className="leads-form-message">{deleteState.message}</p>}
    </form>}
  </section>;
}

export function ContactsWorkspace({ contacts, companies, owners, canCreate, canImport, canExport, createIntent, canEditAll, canEditOwn, canReassign, currentUserId, search, lifecycle, companyId, ownerId, page, matchedCount, totalCount, activeCount, customerCount, sort, visibleColumns, savedViews, activeViewId }: {
  contacts: ContactListRow[]; companies: CompanyOption[]; owners: ContactOwner[]; canCreate: boolean; canImport: boolean; canExport: boolean; createIntent: boolean; canEditAll: boolean; canEditOwn: boolean; canReassign: boolean; currentUserId: string;
  search: string; lifecycle: string; companyId: string; ownerId: string; page: number; matchedCount: number; totalCount: number; activeCount: number; customerCount: number;
  sort: ContactViewSort; visibleColumns: ContactViewColumn[]; savedViews: ContactSavedView[]; activeViewId: string;
}) {
  const dateFormat = useDateFormat();
  const [dialog, setDialog] = useState<DialogKind | null>(createIntent && canCreate ? "contact" : null);
  const [editing, setEditing] = useState<ContactRow | undefined>();
  const openCreateForm = useCallback(() => { setEditing(undefined); setDialog("contact"); }, []);
  useCreateIntent(createIntent, canCreate, openCreateForm);
  const pageCount = Math.max(1, Math.ceil(matchedCount / contactPageSize));
  const open = (contact?: ContactRow) => { setEditing(contact); setDialog("contact"); };
  return <main className="page-container leads-page contacts-page">
    <header className="leads-header"><div><h1 className="page-title">Contacts</h1><p className="page-description">Keep customer and prospect relationships clear and actionable.</p></div><div className="entity-list-actions">{canExport && <a className="leads-secondary-button" href={filteredExportHref("contacts", { q: search, lifecycle, company: companyId, owner: ownerId })}>Export CSV</a>}{canImport && <a className="leads-secondary-button" href="/app/data-import?entity=contacts">Import CSV</a>}{canCreate && <button className="leads-primary-button" onClick={() => open()} type="button"><Plus aria-hidden="true" size={16} />Add Contact</button>}</div></header>
    <section aria-label="Contact summary" className="leads-summary"><div><span>Total contacts</span><strong>{totalCount.toLocaleString()}</strong></div><div><span>Active</span><strong>{activeCount.toLocaleString()}</strong></div><div><span>Customers</span><strong>{customerCount.toLocaleString()}</strong></div></section>
    <section aria-label="Contacts" className="leads-panel"><form action="/app/contacts" className="leads-toolbar" method="get">
      <label className="leads-search"><span className="sr-only">Search contacts</span><input autoComplete="off" defaultValue={search} maxLength={100} name="q" onChange={clearSelectedView} placeholder="Search contacts by name, company, email, or phone" type="search" /></label>
      <label className="leads-filter"><span className="sr-only">Filter by lifecycle</span><select aria-label="Filter by lifecycle" defaultValue={lifecycle} name="lifecycle" onChange={clearSelectedView}><option value="all">All lifecycle stages</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="customer">Customer</option><option value="former_customer">Former customer</option></select></label>
      <label className="leads-filter"><span className="sr-only">Filter by company</span><select aria-label="Filter by company" defaultValue={companyId} name="company" onChange={clearSelectedView}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      <label className="leads-filter"><span className="sr-only">Filter by owner</span><select aria-label="Filter by owner" defaultValue={ownerId} name="owner" onChange={clearSelectedView}><option value="">All owners</option><option value="unassigned">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>
      <label className="leads-filter"><span className="sr-only">Saved view</span><select aria-label="Saved view" defaultValue={activeViewId} name="view"><option value="">Current filters</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
      <label className="leads-filter"><span className="sr-only">Sort contacts</span><select aria-label="Sort contacts" defaultValue={sort} name="sort" onChange={clearSelectedView}>{contactViewSorts.map((option) => <option key={option} value={option}>{contactSortLabels[option]}</option>)}</select></label>
      <button className="leads-secondary-button" type="submit">Apply filters</button>
    </form>
    <SavedContactViewControls activeViewId={activeViewId} companyId={companyId} lifecycle={lifecycle} ownerId={ownerId} search={search} sort={sort} visibleColumns={visibleColumns} />
    <div className="leads-table-wrap"><table className="leads-table contact-table"><thead><tr>{visibleColumns.includes("name") && <th scope="col">Name</th>}{visibleColumns.includes("company") && <th scope="col">Company</th>}{visibleColumns.includes("job_title") && <th scope="col">Job title</th>}{visibleColumns.includes("email") && <th scope="col">Email</th>}{visibleColumns.includes("phone") && <th scope="col">Phone</th>}{visibleColumns.includes("owner") && <th scope="col">Owner</th>}{visibleColumns.includes("lifecycle") && <th scope="col">Lifecycle</th>}{visibleColumns.includes("last_activity") && <th scope="col">Last Activity</th>}{visibleColumns.includes("next_activity") && <th scope="col">Next Activity</th>}{visibleColumns.includes("tags") && <th scope="col">Tags</th>}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{contacts.map((contact) => {
      const canEdit = canEditAll || (canEditOwn && contact.owner_id === currentUserId);
      const subline = [visibleColumns.includes("email") ? contact.email : null, visibleColumns.includes("phone") ? contact.phone : null].find(Boolean);
       return <tr key={contact.id}>{visibleColumns.includes("name") && <td data-label="Name"><a className="contact-row-name" href={`/app/contacts/${contact.id}`}>{fullName(contact)}</a>{subline && <span className="contact-row-subline">{subline}</span>}</td>}{visibleColumns.includes("company") && <td data-label="Company">{contact.company?.name ?? "—"}</td>}{visibleColumns.includes("job_title") && <td data-label="Job title">{contact.job_title || "—"}</td>}{visibleColumns.includes("email") && <td data-label="Email">{contact.email ? <a className="contact-link" href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</td>}{visibleColumns.includes("phone") && <td data-label="Phone">{contact.phone ? <a className="contact-link" href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</td>}{visibleColumns.includes("owner") && <td data-label="Owner">{ownerName(contact.owner_id, owners)}</td>}{visibleColumns.includes("lifecycle") && <td data-label="Lifecycle"><span className={lifecycleClass(contact.lifecycle_status)}>{lifecycleLabels[contact.lifecycle_status]}</span></td>}{visibleColumns.includes("last_activity") && <td data-label="Last Activity">{contact.lastActivity ? <time dateTime={contact.lastActivity}>{formatContactDate(contact.lastActivity, dateFormat)}</time> : "—"}</td>}{visibleColumns.includes("next_activity") && <td data-label="Next Activity">{contact.nextActivity ? <time dateTime={contact.nextActivity}>{formatContactDate(contact.nextActivity, dateFormat)}</time> : "—"}</td>}{visibleColumns.includes("tags") && <td data-label="Tags">{contact.tags.length ? <span className="contact-tag-list">{contact.tags.map((tag) => <span className="contact-tag" key={tag.id}>{tag.name}</span>)}</span> : "—"}</td>}<td className="leads-row-action">{canEdit && <button className="leads-edit-button" onClick={() => open(contact)} type="button">Edit</button>}</td></tr>;
    })}</tbody></table></div>
    {contacts.length === 0 && <div className="leads-empty"><h2>{search || lifecycle !== "all" || companyId || ownerId ? "No matching contacts" : "No contacts yet"}</h2><p>{search || lifecycle !== "all" || companyId || ownerId ? "Try changing or clearing your filters." : "Contacts added to this workspace will appear here."}</p>{canCreate && !search && lifecycle === "all" && !companyId && !ownerId && <button className="leads-secondary-button" onClick={() => open()} type="button">Add your first contact</button>}</div>}
    <nav aria-label="Contacts pages" className="leads-pagination"><span>{matchedCount === 0 ? "0 records" : `${(page - 1) * contactPageSize + 1}–${Math.min(page * contactPageSize, matchedCount)} of ${matchedCount} records`}</span><div><a aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={page <= 1 ? undefined : pageHref(page - 1, search, lifecycle, companyId, ownerId, sort, activeViewId)}>Previous</a><span>Page {page} of {pageCount}</span><a aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={page >= pageCount ? undefined : pageHref(page + 1, search, lifecycle, companyId, ownerId, sort, activeViewId)}>Next</a></div></nav>
    </section>{dialog === "contact" && <ContactForm companies={companies} owners={owners} canReassign={canReassign} contact={editing} onClose={() => setDialog(null)} />}
  </main>;
}

function pageHref(page: number, query: string, lifecycle: string, company: string, owner: string, sort: ContactViewSort, viewId: string) {
  const params = new URLSearchParams(); if (query) params.set("q", query); if (lifecycle !== "all") params.set("lifecycle", lifecycle); if (company) params.set("company", company); if (owner) params.set("owner", owner); if (sort !== "updated_desc") params.set("sort", sort); if (viewId) params.set("view", viewId); params.set("page", String(page)); return `/app/contacts?${params.toString()}`;
}

export function ContactDetailWorkspace({ contact, company, deals, activities, activityCount, activityPage, tasks, notes, attachments, owners, companies, canEdit, canReassign, view }: {
  contact: ContactRow; company: ContactCompany | null; deals: ContactDeal[]; activities: ContactActivity[]; activityCount: number; activityPage: number; tasks: ContactTask[]; notes: ContactNote[]; attachments: ContactAttachment[];
  owners: ContactOwner[]; companies: CompanyOption[]; canEdit: boolean; canReassign: boolean; view: string;
}) {
  const dateFormat = useDateFormat();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [taskMessage, setTaskMessage] = useState("");
  const router = useRouter();
  const contactName = fullName(contact);
  const activeView = ["overview", "activity", "deals", "tasks", "files"].includes(view) ? view : "overview";
  const upcoming = tasks.filter((task) => task.status === "open").sort((a, b) => (a.due_at ?? "9999-12-31").localeCompare(b.due_at ?? "9999-12-31"))[0];
  async function completeTask(taskId: string) { const completion = await completeContactTaskAction(taskId); setTaskMessage(completion.message ?? "Task could not be completed."); if (completion.ok || completion.refreshRequired) router.refresh(); }
  return <main className="page-container leads-page contact-detail-page">
    <div className="contact-breadcrumb"><nav aria-label="Breadcrumb"><Link href="/app/contacts">← Back to Contacts</Link></nav><div className="contact-header-actions">{contact.email && <a className="leads-secondary-button" href={`mailto:${contact.email}`}><Mail size={15} />Send email</a>}{contact.phone && <a className="leads-secondary-button" href={`tel:${contact.phone}`}><Phone size={15} />Call</a>}{canEdit && <button className="leads-secondary-button" onClick={() => setDialog("activity")} type="button"><Plus size={15} />Log activity</button>}{canEdit && <button className="leads-primary-button" onClick={() => setDialog("contact")} type="button">Edit Contact</button>}</div></div>
    <section className="contact-hero"><div className="contact-initials" aria-hidden="true">{initials(contact)}</div><div className="contact-hero-copy"><div className="contact-name-line"><h1>{contactName}</h1><span className={lifecycleClass(contact.lifecycle_status)}>{lifecycleLabels[contact.lifecycle_status]}</span></div><p>{contact.job_title || "No job title"}{company ? <> at <a href="#company">{company.name}</a></> : ""}</p></div></section>
    <nav aria-label="Contact sections" className="contact-tabs">{(["overview", "activity", "deals", "tasks", "files"] as const).map((tab) => <a aria-current={activeView === tab ? "page" : undefined} className={activeView === tab ? "is-active" : ""} href={`/app/contacts/${contact.id}?view=${tab}`} key={tab}>{tab[0].toUpperCase() + tab.slice(1)}{tab === "deals" ? ` (${deals.length})` : tab === "tasks" ? ` (${tasks.length})` : tab === "files" ? ` (${attachments.length})` : ""}</a>)}</nav>
    {taskMessage && <p aria-live="polite" className="contact-task-message">{taskMessage}</p>}
    <div className="contact-detail-grid"><div className="contact-detail-main">
      {(activeView === "overview" || activeView === "activity") && <section className="contact-section"><SectionHeading title={activeView === "overview" ? "Recent Activity" : "Activity"}>{canEdit && <button className="leads-secondary-button" onClick={() => setDialog("activity")} type="button"><Plus size={14} />Log activity</button>}</SectionHeading><Timeline activities={activeView === "overview" ? activities.slice(0, 5) : activities} dateFormat={dateFormat} />{activeView === "activity" && <ActivityPagination contactId={contact.id} count={activityCount} page={activityPage} />}</section>}
      {activeView === "overview" && <section className="contact-section"><SectionHeading title="Notes">{canEdit && <button className="leads-secondary-button" onClick={() => setDialog("note")} type="button"><Plus size={14} />Add note</button>}</SectionHeading><Notes notes={notes.slice(0, 3)} dateFormat={dateFormat} /></section>}
      {(activeView === "overview" || activeView === "deals") && <section className="contact-section"><SectionHeading title={activeView === "overview" ? "Related Deals" : "Deals"} /><Deals deals={deals} dateFormat={dateFormat} /></section>}
      {activeView === "tasks" && <section className="contact-section"><SectionHeading title="Tasks">{canEdit && <button className="leads-secondary-button" onClick={() => setDialog("task")} type="button"><Plus size={14} />Add task</button>}</SectionHeading><Tasks tasks={tasks} canEdit={canEdit} onComplete={completeTask} dateFormat={dateFormat} /></section>}
      {activeView === "files" && <section className="contact-section"><SectionHeading title="Files" />{canEdit && <FileUpload contactId={contact.id} />}{attachments.length ? <FileList files={attachments} dateFormat={dateFormat} /> : <Empty title="No files yet" description="Files attached to this contact will appear here." />}</section>}
    </div><aside className="contact-detail-rail"><section className="contact-rail-section"><SectionHeading title="Contact Information">{canEdit && <button aria-label="Edit contact information" className="contact-text-button" onClick={() => setDialog("contact")} type="button">Edit</button>}</SectionHeading><Property label="Email">{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</Property><Property label="Phone">{contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</Property><Property label="Company">{company?.name ?? "—"}</Property><Property label="Job title">{contact.job_title || "—"}</Property><Property label="Owner">{ownerName(contact.owner_id, owners)}</Property><Property label="Lifecycle"><span className={lifecycleClass(contact.lifecycle_status)}>{lifecycleLabels[contact.lifecycle_status]}</span></Property><Property label="Created"><time dateTime={contact.created_at}>{formatContactDate(contact.created_at, dateFormat)}</time></Property></section>
      {company && <section className="contact-rail-section" id="company"><SectionHeading title="Company" /><h3 className="contact-company-title">{company.name}</h3><p className="contact-company-meta">{[company.industry, company.employee_size ? `${company.employee_size.toLocaleString()} employees` : null].filter(Boolean).join(" · ") || "Company details"}</p>{company.description && <p className="contact-company-description">{company.description}</p>}</section>}
      <section className="contact-rail-section"><SectionHeading title="Upcoming Task"><a className="contact-text-button" href={`/app/contacts/${contact.id}?view=tasks`}>View all</a></SectionHeading>{upcoming ? <div className="contact-upcoming"><strong>{upcoming.title}</strong>{upcoming.description && <p>{upcoming.description}</p>}<time dateTime={upcoming.due_at ?? undefined}><CalendarClock size={14} />{formatContactDateTime(upcoming.due_at, dateFormat)}</time>{canEdit && <button className="leads-secondary-button" onClick={() => completeTask(upcoming.id)} type="button"><Check size={14} />Complete task</button>}</div> : <p className="contact-muted">No upcoming tasks.</p>}{canEdit && <button className="contact-add-task" onClick={() => setDialog("task")} type="button"><Plus size={14} />Add task</button>}</section>
    </aside></div>
    {dialog === "contact" && <ContactForm companies={companies} owners={owners} canReassign={canReassign} contact={contact} onClose={() => setDialog(null)} />}{dialog && dialog !== "contact" && <EngagementForm kind={dialog} contactId={contact.id} owners={owners} canReassign={canReassign} onClose={() => setDialog(null)} />}
  </main>;
}

function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) { return <header className="contact-section-heading"><h2>{title}</h2>{children}</header>; }
function Property({ label, children }: { label: string; children: React.ReactNode }) { return <div className="contact-property"><span>{label}</span><div>{children}</div></div>; }
function Empty({ title, description }: { title: string; description: string }) { return <div className="contact-empty"><h3>{title}</h3><p>{description}</p></div>; }
function ActivityPagination({ contactId, count, page }: { contactId: string; count: number; page: number }) {
  const pageCount = Math.max(1, Math.ceil(count / contactPageSize));
  const href = (targetPage: number) => `/app/contacts/${contactId}?view=activity&page=${targetPage}`;
  return <nav aria-label="Activity pages" className="contact-activity-pagination"><span>{count ? `${(page - 1) * contactPageSize + 1}–${Math.min(page * contactPageSize, count)} of ${count} activities` : "0 activities"}</span><div><a aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={page <= 1 ? undefined : href(page - 1)}>Previous</a><span>Page {page} of {pageCount}</span><a aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={page >= pageCount ? undefined : href(page + 1)}>Next</a></div></nav>;
}
function Timeline({ activities, dateFormat }: { activities: ContactActivity[]; dateFormat: DateFormat }) { return activities.length ? <ol className="contact-timeline">{activities.map((activity) => <li key={activity.id}><span className="contact-timeline-marker" aria-hidden="true" /><div><div className="contact-activity-title"><strong>{activity.subject || "Activity"}</strong><time dateTime={activity.occurred_at}>{formatContactDateTime(activity.occurred_at, dateFormat)}</time></div><span className="contact-activity-type">{activity.activity_type.replaceAll("_", " ")}</span>{activity.body && <p>{activity.body}</p>}</div></li>)}</ol> : <Empty title="No activity yet" description="Log a call, email, meeting, or note to start this contact’s history." />; }
function Notes({ notes, dateFormat }: { notes: ContactNote[]; dateFormat: DateFormat }) { return notes.length ? <div className="contact-notes">{notes.map((note) => <article key={note.id}><p>{note.body}</p><time dateTime={note.created_at}>{formatCalendarDateTime(note.created_at, dateFormat)}</time></article>)}</div> : <Empty title="No notes yet" description="Add a note to keep useful context with this contact." />; }
function Deals({ deals, dateFormat }: { deals: ContactDeal[]; dateFormat: DateFormat }) { return deals.length ? <div className="contact-deal-table-wrap"><table className="contact-deal-table"><thead><tr><th scope="col">Deal name</th><th scope="col">Stage</th><th scope="col">Value</th><th scope="col">Close date</th><th scope="col">Status</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id}><td>{deal.title}</td><td>{deal.stage?.name ?? "—"}</td><td>{new Intl.NumberFormat(undefined, { style: "currency", currency: deal.currency || "USD", maximumFractionDigits: 0 }).format(Number(deal.amount))}</td><td>{deal.expected_close_date ? formatCalendarDate(deal.expected_close_date, dateFormat) : "—"}</td><td><span className={`contact-deal-status status-${deal.status}`}>{deal.status}</span></td></tr>)}</tbody></table></div> : <Empty title="No related deals" description="Deals linked to this contact will appear here." />; }
function Tasks({ tasks, canEdit, onComplete, dateFormat }: { tasks: ContactTask[]; canEdit: boolean; onComplete: (id: string) => void; dateFormat: DateFormat }) { return tasks.length ? <ul className="contact-task-list">{tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><span>{task.description || task.task_type.replaceAll("_", " ")} · {formatContactDateTime(task.due_at, dateFormat)}</span></div><span className={`contact-deal-status status-${task.status}`}>{task.status}</span>{canEdit && task.status === "open" && <button aria-label={`Complete ${task.title}`} className="leads-secondary-button" onClick={() => onComplete(task.id)} type="button"><Check size={14} />Complete</button>}</li>)}</ul> : <Empty title="No tasks yet" description="Create a follow-up task to keep the next step visible." />; }
function FileList({ files, dateFormat }: { files: ContactAttachment[]; dateFormat: DateFormat }) { return <ul className="contact-file-list">{files.map((file) => <li key={file.id}><div><strong>{file.filename}</strong><span>{file.mime_type} · {(file.size_bytes / 1024).toFixed(0)} KB · {formatCalendarDate(file.created_at, dateFormat)}</span></div><a className="leads-secondary-button" href={`/app/contacts/files/${file.id}`}>Download</a></li>)}</ul>; }

function filteredExportHref(entity: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") params.set(key, value);
  return `/app/${entity}/export${params.size ? `?${params.toString()}` : ""}`;
}

function FileUpload({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState(uploadContactFileAction, blank);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, router]);
  return <form action={formAction} className="contact-file-upload"><input name="contactId" type="hidden" value={contactId} /><label className="leads-field"><span>Choose a file (PDF, text, CSV, DOCX, XLSX, or PPTX; up to 10 MB)</span><input accept=".pdf,.txt,.csv,.docx,.xlsx,.pptx" name="file" required type="file" /></label><button className="leads-secondary-button" disabled={pending} type="submit"><Plus size={14} />{pending ? "Uploading…" : "Upload file"}</button>{state.message && <p aria-live="polite" className={state.ok ? "contact-success" : "contact-form-error"}>{state.message}</p>}</form>;
}
