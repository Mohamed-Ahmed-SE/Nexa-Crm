"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createLeadAction, deleteLeadViewAction, saveLeadViewAction, updateLeadAction, type LeadActionState } from "./actions";
import { LeadConversionDialog } from "./lead-conversion-dialog";
import type { LeadConversionOptions } from "@/lib/leads/repository";
import type { LeadOwner, LeadRow, LeadSavedView, LeadSource } from "@/lib/leads/repository";
import { leadViewColumns, leadViewSorts, type LeadViewColumn, type LeadViewSort } from "@/lib/leads/saved-view-schema";
import { needsRetainedRelationOption } from "@/lib/leads/relations";
import type { LeadFilterStatus, LeadStatus } from "@/lib/leads/schema";
import { useCreateIntent } from "../use-create-intent";

const emptyState: LeadActionState = {};
const statusLabels: Record<LeadFilterStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
};
const editableStatusOptions = Object.entries(statusLabels).filter(([value]) => value !== "converted");

type LeadFormProps = {
  lead?: LeadRow;
  sources: LeadSource[];
  owners: LeadOwner[];
  currency: string;
  canReassign: boolean;
  onClose: () => void;
};

function LeadForm({ lead, sources, owners, currency, canReassign, onClose }: LeadFormProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const action = lead ? updateLeadAction : createLeadAction;
  const [state, formAction, pending] = useActionState(action, emptyState);
  const [status, setStatus] = useState(lead?.status === "converted" ? "new" : lead?.status ?? "new");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button')?.focus();
    return () => previouslyFocused?.focus();
  }, []);
  useEffect(() => {
    if (!state.ok) return;
    onClose();
    router.refresh();
  }, [state.ok, router, onClose]);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="leads-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <section aria-labelledby="lead-form-title" aria-modal="true" className="leads-dialog" onKeyDown={handleDialogKeyDown} ref={dialogRef} role="dialog" tabIndex={-1}>
        <header className="leads-dialog-header">
          <div><h2 id="lead-form-title">{lead ? "Edit lead" : "Add lead"}</h2><p>{lead ? "Update this workspace lead’s details." : "Add a prospect to this workspace."}</p></div>
          <button aria-label="Close lead form" className="leads-icon-button" disabled={pending} onClick={onClose} type="button"><X size={17} /></button>
        </header>
        <form action={formAction} className="leads-form">
          {lead && <input name="id" type="hidden" value={lead.id} />}
          <Field label="Full name" name="fullName" required error={errors.fullName?.[0]} defaultValue={lead?.full_name ?? ""} />
          <div className="leads-form-grid">
            <Field label="Company" name="companyName" error={errors.companyName?.[0]} defaultValue={lead?.company_name ?? ""} />
            <Field label="Job title" name="jobTitle" error={errors.jobTitle?.[0]} defaultValue={lead?.job_title ?? ""} />
            <Field label="Email" name="email" type="email" error={errors.email?.[0]} defaultValue={lead?.email ?? ""} />
            <Field label="Phone" name="phone" type="tel" error={errors.phone?.[0]} defaultValue={lead?.phone ?? ""} />
            <label className="leads-field"><span>Status</span><select name="status" onChange={(event) => setStatus(event.target.value as LeadStatus)} value={status}>{editableStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.status?.[0] && <small>{errors.status[0]}</small>}</label>
            <label className="leads-field"><span>Source</span><select defaultValue={lead?.source_id ?? ""} name="sourceId"><option value="">No source</option>{lead?.source_id && needsRetainedRelationOption(lead.source_id, sources.map((source) => source.id)) && <option value={lead.source_id}>Current source (inactive — retained)</option>}{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>{errors.sourceId?.[0] && <small>{errors.sourceId[0]}</small>}</label>
            <Field label={`Estimated value (${currency})`} name="estimatedValue" min="0" step="0.01" type="number" error={errors.estimatedValue?.[0]} defaultValue={lead?.estimated_value ?? 0} />
            {canReassign ? <label className="leads-field"><span>Owner</span><select defaultValue={lead?.owner_id ?? ""} name="ownerId"><option value="">Unassigned</option>{lead?.owner_id && needsRetainedRelationOption(lead.owner_id, owners.map((owner) => owner.id)) && <option value={lead.owner_id}>Current owner (inactive — retained)</option>}{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select>{errors.ownerId?.[0] && <small>{errors.ownerId[0]}</small>}</label> : <input name="ownerId" type="hidden" value={lead?.owner_id ?? ""} />}
          </div>
          <label className="leads-field"><span>Notes <em>Optional</em></span><textarea defaultValue={lead?.notes_summary ?? ""} name="notesSummary" rows={3} />{errors.notesSummary?.[0] && <small>{errors.notesSummary[0]}</small>}</label>
          {state.message && <p aria-live="polite" className={state.ok ? "leads-form-message is-success" : "leads-form-message"}>{state.message}</p>}
          <footer className="leads-form-footer"><button className="leads-secondary-button" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : lead ? "Save changes" : "Add lead"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, name, error, ...inputProps }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string }) {
  const errorId = error ? `${name}-error` : undefined;
  return <label className="leads-field"><span>{label}{inputProps.required && <b aria-hidden="true"> *</b>}</span><input aria-describedby={errorId} aria-invalid={Boolean(error)} name={name} {...inputProps} />{error && <small id={errorId}>{error}</small>}</label>;
}

function formatValue(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
}

function ownerLabel(ownerId: string | null, owners: LeadOwner[]) {
  return ownerId ? owners.find((owner) => owner.id === ownerId)?.label ?? `Workspace member · ${ownerId.slice(0, 6)}` : "Unassigned";
}

function sourceLabel(sourceId: string | null, sources: LeadSource[]) {
  return sourceId ? sources.find((source) => source.id === sourceId)?.name ?? "Inactive source" : "—";
}

const columnLabels: Record<LeadViewColumn, string> = {
  name: "Name", company: "Company", status: "Status", source: "Source",
  owner: "Owner", value: "Estimated value", updated: "Updated",
};
const sortLabels: Record<LeadViewSort, string> = {
  updated_desc: "Recently updated", updated_asc: "Least recently updated",
  name_asc: "Name A–Z", name_desc: "Name Z–A", value_asc: "Value low to high", value_desc: "Value high to low",
};

function clearSelectedSavedView(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
  const viewSelect = event.currentTarget.form?.elements.namedItem("view");
  if (viewSelect instanceof HTMLSelectElement) viewSelect.value = "";
}

function SavedViewControls({
  search, status, source, owner, sort, visibleColumns, activeViewId,
}: {
  search: string; status: string; source: string; owner: string; sort: LeadViewSort;
  visibleColumns: LeadViewColumn[]; activeViewId: string;
}) {
  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(saveLeadViewAction, emptyState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteLeadViewAction, emptyState);
  useEffect(() => {
    if (saveState.ok || deleteState.ok) router.refresh();
  }, [saveState.ok, deleteState.ok, router]);
  return <section aria-label="Saved lead views" className="leads-view-controls">
    <form action={saveAction} className="leads-view-save">
      <label className="leads-field"><span>Save current view</span><input maxLength={80} name="name" placeholder="View name" required /></label>
      <input name="q" type="hidden" value={search} /><input name="status" type="hidden" value={status} />
      <input name="sourceId" type="hidden" value={source} /><input name="ownerId" type="hidden" value={owner} />
      <input name="sort" type="hidden" value={sort} />
      <fieldset><legend>Visible columns</legend>{leadViewColumns.map((column) => <label key={column}><input defaultChecked={visibleColumns.includes(column)} name="visibleColumns" type="checkbox" value={column} />{columnLabels[column]}</label>)}</fieldset>
      <button className="leads-secondary-button" disabled={savePending} type="submit">{savePending ? "Saving…" : "Save view"}</button>
      {saveState.message && <p aria-live="polite" className="leads-form-message">{saveState.message}</p>}
    </form>
    {activeViewId && <form action={deleteAction} className="leads-view-delete">
      <input name="id" type="hidden" value={activeViewId} />
      <button className="leads-secondary-button" disabled={deletePending} type="submit">{deletePending ? "Deleting…" : "Delete this view"}</button>
      {deleteState.message && <p aria-live="polite" className="leads-form-message">{deleteState.message}</p>}
    </form>}
  </section>;
}

export function LeadWorkspace({
  leads, sources, owners, canCreate, canImport, canExport, createIntent, canEditAll, canConvert, conversionOptions, canReassign, currentUserId, currency, search, statusFilter, sourceFilter, page, totalCount, matchedCount, newCount, qualifiedCount, ownerFilter, sort, visibleColumns, savedViews, activeViewId,
}: {
  leads: LeadRow[]; sources: LeadSource[]; owners: LeadOwner[]; canCreate: boolean; canImport: boolean; canExport: boolean; createIntent: boolean; canEditAll: boolean; canConvert: boolean; conversionOptions: LeadConversionOptions; canReassign: boolean; currentUserId: string; currency: string;
  search: string; statusFilter: string; sourceFilter: string; ownerFilter: string; page: number; totalCount: number; matchedCount: number; newCount: number; qualifiedCount: number;
  sort: LeadViewSort; visibleColumns: LeadViewColumn[]; savedViews: LeadSavedView[]; activeViewId: string;
}) {
  const [formLead, setFormLead] = useState<LeadRow | null | undefined>(createIntent && canCreate ? null : undefined);
  const [conversionLead, setConversionLead] = useState<LeadRow | null>(null);
  const openCreateForm = useCallback(() => setFormLead(null), []);
  useCreateIntent(createIntent, canCreate, openCreateForm);
  const pageCount = Math.max(1, Math.ceil(matchedCount / 25));
  const actionVisible = canEditAll || canReassign || canCreate || canConvert;

  return <main className="page-container leads-page">
    <header className="leads-header">
      <div><h1 className="page-title">Leads</h1><p className="page-description">Track, qualify, and manage prospective customers in this workspace.</p></div>
      <div className="entity-list-actions">{canExport && <a className="leads-secondary-button" href={filteredExportHref("leads", { q: search, status: statusFilter, source: sourceFilter, owner: ownerFilter })}>Export CSV</a>}{canImport && <a className="leads-secondary-button" href="/app/data-import?entity=leads">Import CSV</a>}{canCreate && <button className="leads-primary-button" onClick={() => setFormLead(null)} type="button"><Plus aria-hidden="true" size={16} />Add Lead</button>}</div>
    </header>

    <section aria-label="Lead status counts" className="leads-summary">
      <div><span>Total leads</span><strong>{totalCount.toLocaleString()}</strong></div>
      <div><span>New</span><strong>{newCount.toLocaleString()}</strong></div>
      <div><span>Qualified</span><strong>{qualifiedCount.toLocaleString()}</strong></div>
    </section>

    <section aria-label="Leads" className="leads-panel">
      <form action="/app/leads" className="leads-toolbar" method="get">
        <label className="leads-search"><span className="sr-only">Search leads by name, company, or email</span><input autoComplete="off" defaultValue={search} maxLength={100} name="q" onChange={clearSelectedSavedView} placeholder="Search leads by name, company, or email" type="search" /></label>
        <label className="leads-filter"><span className="sr-only">Filter by status</span><select aria-label="Filter by status" defaultValue={statusFilter} name="status" onChange={clearSelectedSavedView}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="leads-filter"><span className="sr-only">Filter by source</span><select aria-label="Filter by source" defaultValue={sourceFilter} name="source" onChange={clearSelectedSavedView}><option value="">All sources</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label className="leads-filter"><span className="sr-only">Filter by owner</span><select aria-label="Filter by owner" defaultValue={ownerFilter} name="owner" onChange={clearSelectedSavedView}><option value="">All owners</option><option value="unassigned">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>
        <label className="leads-filter"><span className="sr-only">Saved view</span><select aria-label="Saved view" defaultValue={activeViewId} name="view"><option value="">Current filters</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
        <label className="leads-filter"><span className="sr-only">Sort leads</span><select aria-label="Sort leads" defaultValue={sort} name="sort" onChange={clearSelectedSavedView}>{leadViewSorts.map((item) => <option key={item} value={item}>{sortLabels[item]}</option>)}</select></label>
        <button className="leads-secondary-button" type="submit">Apply filters</button>
      </form>
      <SavedViewControls activeViewId={activeViewId} owner={ownerFilter} search={search} sort={sort} source={sourceFilter} status={statusFilter} visibleColumns={visibleColumns} />
      <div className="leads-table-wrap">
        <table className="leads-table">
          <thead><tr>{visibleColumns.includes("name") && <th scope="col">Name</th>}{visibleColumns.includes("company") && <th scope="col">Company</th>}{visibleColumns.includes("status") && <th scope="col">Status</th>}{visibleColumns.includes("source") && <th scope="col">Source</th>}{visibleColumns.includes("owner") && <th scope="col">Owner</th>}{visibleColumns.includes("value") && <th scope="col">Estimated value</th>}{visibleColumns.includes("updated") && <th scope="col">Updated</th>}{actionVisible && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>{leads.map((lead) => {
            const canEdit = canEditAll || lead.owner_id === currentUserId;
            return <tr key={lead.id}>
              {visibleColumns.includes("name") && <td data-label="Name"><Link className="contact-row-name" href={`/app/leads/${lead.id}`}>{lead.full_name}</Link>{lead.email && <a className="leads-subline" href={`mailto:${lead.email}`}>{lead.email}</a>}</td>}
              {visibleColumns.includes("company") && <td data-label="Company">{lead.company_name || "—"}</td>}
              {visibleColumns.includes("status") && <td data-label="Status"><span className={`leads-status status-${lead.status}`}>{lead.status === "converted" ? "Converted" : statusLabels[lead.status]}</span></td>}
              {visibleColumns.includes("source") && <td data-label="Source">{sourceLabel(lead.source_id, sources)}</td>}
              {visibleColumns.includes("owner") && <td data-label="Owner">{ownerLabel(lead.owner_id, owners)}</td>}
              {visibleColumns.includes("value") && <td data-label="Estimated value" className="leads-amount">{formatValue(Number(lead.estimated_value), lead.currency || currency)}</td>}
              {visibleColumns.includes("updated") && <td data-label="Updated"><time dateTime={lead.updated_at}>{new Date(lead.updated_at).toLocaleDateString()}</time></td>}
              {actionVisible && <td className="leads-row-action">{canEdit && lead.status !== "converted" ? <div className="leads-row-actions"><button aria-label={`Edit ${lead.full_name}`} className="leads-edit-button" onClick={() => setFormLead(lead)} type="button">Edit</button>{canConvert && <button aria-label={`Convert ${lead.full_name}`} className="leads-edit-button" onClick={() => setConversionLead(lead)} type="button">Convert</button>}</div> : <span aria-label="Read only" className="leads-read-only">—</span>}</td>}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {leads.length === 0 && <div className="leads-empty"><h2>{search || statusFilter !== "all" || sourceFilter || ownerFilter ? "No matching leads" : "No leads yet"}</h2><p>{search || statusFilter !== "all" || sourceFilter || ownerFilter ? "Try changing or clearing your filters." : "Leads you add to this workspace will appear here."}</p>{canCreate && !search && statusFilter === "all" && !sourceFilter && !ownerFilter && <button className="leads-secondary-button" onClick={() => setFormLead(null)} type="button">Add your first lead</button>}</div>}
      <nav aria-label="Leads pages" className="leads-pagination"><span>{matchedCount === 0 ? "0 records" : `${(page - 1) * 25 + 1}–${Math.min(page * 25, matchedCount)} of ${matchedCount} records`}</span><div><a aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={page <= 1 ? undefined : pageHref({ page: page - 1, q: search, status: statusFilter, source: sourceFilter, owner: ownerFilter, sort, viewId: activeViewId })}>Previous</a><span>Page {page} of {pageCount}</span><a aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={page >= pageCount ? undefined : pageHref({ page: page + 1, q: search, status: statusFilter, source: sourceFilter, owner: ownerFilter, sort, viewId: activeViewId })}>Next</a></div></nav>
    </section>
    {formLead !== undefined && <LeadForm canReassign={canReassign} currency={currency} lead={formLead ?? undefined} onClose={() => setFormLead(undefined)} owners={owners} sources={sources} />}
    {conversionLead && <LeadConversionDialog currency={currency} lead={conversionLead} onClose={() => setConversionLead(null)} options={conversionOptions} owners={owners} currentUserId={currentUserId} />}
  </main>;
}

function filteredExportHref(entity: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") params.set(key, value);
  return `/app/${entity}/export${params.size ? `?${params.toString()}` : ""}`;
}

function pageHref({ page, q, status, source, owner, sort, viewId }: {
  page: number; q: string; status: string; source: string; owner: string; sort: LeadViewSort; viewId: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (source) params.set("source", source);
  if (owner) params.set("owner", owner);
  if (sort !== "updated_desc") params.set("sort", sort);
  if (viewId) params.set("view", viewId);
  params.set("page", String(page));
  return `/app/leads?${params.toString()}`;
}
