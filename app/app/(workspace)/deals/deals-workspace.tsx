"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { createDealAction, moveDealStageAction, updateDealAction, type DealActionResult } from "./actions";
import type { DealOwner, DealRow, DealStage, DealsData } from "@/lib/deals/repository";
import { getOwnerInitials, isDealOverdue } from "@/lib/deals/presentation";
import { useCreateIntent } from "../use-create-intent";

type Props = {
  data: DealsData;
  canCreate: boolean;
  canEditOwn: boolean;
  canEditAll: boolean;
  canReassign: boolean;
  currentUserId: string;
  search: string;
  ownerFilter: string;
  todayIso: string;
  view: "board" | "list";
  createIntent: boolean;
};

const priorityLabel = { low: "Low", medium: "Medium", high: "High" } as const;
const emptyResult: DealActionResult = { ok: false, message: "" };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${Math.round(value).toLocaleString()}`; }
}
function shortDate(value: string | null) {
  if (!value) return "No close date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
function moneyByCurrency(deals: DealRow[], weighted = false) {
  const totals = new Map<string, number>();
  for (const deal of deals) totals.set(deal.currency, (totals.get(deal.currency) ?? 0) + Number(deal.amount) * (weighted ? deal.probability / 100 : 1));
  return [...totals].map(([currency, value]) => money(value, currency)).join(" · ") || "—";
}
function ownerLabel(owners: DealOwner[], ownerId: string | null) {
  return ownerId ? owners.find(({ id }) => id === ownerId)?.label ?? "Workspace member" : "Unassigned";
}

function OwnerDisplay({ owners, ownerId }: { owners: DealOwner[]; ownerId: string | null }) {
  const label = ownerLabel(owners, ownerId);
  return <span className="deals-owner"><span aria-hidden="true" className="deals-owner-avatar">{ownerId ? getOwnerInitials(label) : "—"}</span><span className="deals-owner-name">{label}</span></span>;
}

function DealAttention({ deal, todayIso }: { deal: DealRow; todayIso: string }) {
  if (!isDealOverdue(deal.status, deal.expected_close_date, todayIso)) return null;
  return <span aria-label={`Attention needed: expected close date ${shortDate(deal.expected_close_date)} is overdue`} className="deals-attention" role="note"><AlertCircle aria-hidden="true" size={12} /><span>Overdue</span></span>;
}

function DealForm({ deal, data, canReassign, currentUserId, onClose }: {
  deal: DealRow | null;
  data: DealsData;
  canReassign: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DealActionResult>(emptyResult);
  const [contactId, setContactId] = useState(deal?.primary_contact_id ?? "");
  const [companyId, setCompanyId] = useState(deal?.company_id ?? "");
  const contacts = data.contacts.filter((contact) => !contact.company_id || !companyId || contact.company_id === companyId);
  const errors = result.fieldErrors ?? {};

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  function submit(formData: FormData) {
    setResult(emptyResult);
    startTransition(async () => {
      const next = deal ? await updateDealAction(formData) : await createDealAction(formData);
      setResult(next);
      if (next.ok) { onClose(); router.refresh(); }
    });
  }

  return <dialog aria-labelledby="deal-form-title" className="deals-dialog" onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} ref={dialogRef}>
    <header className="deals-dialog-header"><div><h2 id="deal-form-title">{deal ? "Edit deal" : "Add deal"}</h2><p>{deal ? "Update the details for this open deal." : "Add a deal to the selected workspace pipeline."}</p></div><button aria-label="Close deal form" className="deals-icon-button" disabled={pending} onClick={onClose} type="button"><X size={17} /></button></header>
    <form action={submit} className="deals-form">
      <input name="pipelineId" type="hidden" value={deal?.pipeline_id ?? data.pipelineId} />
      {deal && <input name="id" type="hidden" value={deal.id} />}
      <label className="deals-field">Deal name<input autoFocus defaultValue={deal?.title ?? ""} maxLength={200} name="title" required />{errors.title?.[0] && <span>{errors.title[0]}</span>}</label>
      <div className="deals-form-grid">
        <label className="deals-field">Company<select name="companyId" onChange={(event) => { setCompanyId(event.target.value); const selected = data.contacts.find(({ id }) => id === contactId); if (selected?.company_id && selected.company_id !== event.target.value) setContactId(""); }} value={companyId}><option value="">No company</option>{data.companies.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select>{errors.companyId?.[0] && <span>{errors.companyId[0]}</span>}</label>
        <label className="deals-field">Primary contact<select name="contactId" onChange={(event) => setContactId(event.target.value)} value={contactId}><option value="">No contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select>{errors.contactId?.[0] && <span>{errors.contactId[0]}</span>}</label>
        <label className="deals-field">Deal value<input defaultValue={deal?.amount ?? 0} min="0" name="amount" required step="0.01" type="number" />{errors.amount?.[0] && <span>{errors.amount[0]}</span>}</label>
        <label className="deals-field">Expected close<input defaultValue={deal?.expected_close_date ?? ""} name="expectedCloseDate" type="date" />{errors.expectedCloseDate?.[0] && <span>{errors.expectedCloseDate[0]}</span>}</label>
        <label className="deals-field">Priority<select defaultValue={deal?.priority ?? "medium"} name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        {canReassign ? <label className="deals-field">Owner<select defaultValue={deal ? deal.owner_id ?? "" : currentUserId} name="ownerId"><option value="">Unassigned</option>{data.owners.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select>{errors.ownerId?.[0] && <span>{errors.ownerId[0]}</span>}</label> : <input name="ownerId" type="hidden" value={deal?.owner_id ?? currentUserId} />}
      </div>
      <label className="deals-field">Notes<textarea defaultValue={deal?.description ?? ""} maxLength={2000} name="description" rows={3} /></label>
      {!result.ok && result.message && <p className="deals-form-error" role="alert">{result.message}</p>}
      <footer className="deals-form-actions"><button className="deals-button deals-button-secondary" disabled={pending} onClick={onClose} type="button">Cancel</button><button className="deals-button deals-button-primary" disabled={pending} type="submit">{pending ? "Saving…" : deal ? "Save changes" : "Add deal"}</button></footer>
    </form>
  </dialog>;
}

function DealCard({ deal, stages, data, canEdit, moving, onEdit, onMove, onDrag, todayIso }: {
  deal: DealRow; stages: DealStage[]; data: DealsData; canEdit: boolean; moving: boolean; todayIso: string;
  onEdit: () => void; onMove: (stageId: string) => void; onDrag: (dealId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const company = deal.company?.name;
  const primaryContact = deal.contact?.name;
  const moveOptions = stages.filter(({ stage_type }) => stage_type === "open");
  return <article aria-label={`${deal.title}${company ? `, ${company}` : ""}${primaryContact ? `, primary contact ${primaryContact}` : ""}, ${money(Number(deal.amount), deal.currency)}`} className={`deals-card${dragging ? " is-dragging" : ""}${moving ? " is-pending" : ""}`} draggable={canEdit && deal.status === "open" && !moving} onDragEnd={() => setDragging(false)} onDragStart={(event) => { setDragging(true); onDrag(deal.id); event.dataTransfer.setData("text/plain", deal.id); event.dataTransfer.effectAllowed = "move"; }}>
    <div className="deals-card-top"><div className="deals-card-name-actions"><button className="deals-card-title" onClick={onEdit} type="button" disabled={!canEdit}>{deal.title}</button><Link aria-label={`View details for ${deal.title}`} className="deals-view-details" href={`/app/deals/${deal.id}`}>View details</Link></div><div className="deals-card-indicators"><span className={`deals-priority priority-${deal.priority}`}>{priorityLabel[deal.priority]}</span><DealAttention deal={deal} todayIso={todayIso} /></div></div>
    {(company || primaryContact) && <div className="deals-card-relations">{company && <p>{company}</p>}{primaryContact && <p>Contact: {primaryContact}</p>}</div>}
    <div className="deals-card-value"><strong>{money(Number(deal.amount), deal.currency)}</strong><span>{deal.probability}% likely</span></div>
    <div className="deals-card-meta"><span>{shortDate(deal.expected_close_date)}</span><OwnerDisplay ownerId={deal.owner_id} owners={data.owners} /></div>
    <label className="deals-move-control">Move to<select aria-label={`Move ${deal.title} to stage`} disabled={!canEdit || moving || deal.status !== "open"} onChange={(event) => { if (event.target.value) onMove(event.target.value); event.target.value = ""; }} value=""><option value="">Choose stage…</option>{moveOptions.filter(({ id }) => id !== deal.stage_id).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
  </article>;
}

export function DealsWorkspace({ data, canCreate, canEditOwn, canEditAll, canReassign, currentUserId, search, ownerFilter, todayIso, view, createIntent }: Props) {
  const router = useRouter();
  const [deals, setDeals] = useState(data.deals);
  const [formDeal, setFormDeal] = useState<DealRow | null | undefined>(createIntent && canCreate ? null : undefined);
  const openCreateForm = useCallback(() => setFormDeal(null), []);
  useCreateIntent(createIntent, canCreate, openCreateForm);
  const [dragDeal, setDragDeal] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [, startTransition] = useTransition();
  useEffect(() => setDeals(data.deals), [data.deals]);

  const stages = useMemo(() => data.stages.slice().sort((a, b) => a.position - b.position), [data.stages]);
  const canEdit = (deal: DealRow) => canEditAll || (canEditOwn && deal.owner_id === currentUserId);
  const totals = useMemo(() => stages.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stage_id === stage.id);
    return { ...stage, deals: stageDeals, total: moneyByCurrency(stageDeals) };
  }), [deals, stages]);

  function move(dealId: string, destinationId: string) {
    const current = deals.find((deal) => deal.id === dealId);
    const target = stages.find((stage) => stage.id === destinationId);
    if (!current || !target || target.stage_type !== "open" || current.stage_id === destinationId || !canEdit(current)) return;
    const previous = current;
    setPendingIds((ids) => new Set(ids).add(dealId));
    setNotice("");
    setDeals((items) => items.map((deal) => deal.id === dealId ? { ...deal, stage_id: destinationId, probability: target.probability } : deal));
    startTransition(async () => {
      const result = await moveDealStageAction(dealId, previous.stage_id, destinationId);
      if (!result.ok) {
        setDeals((items) => items.map((deal) => deal.id === dealId ? previous : deal));
        setNotice(result.message);
      } else {
        setNotice("Deal moved.");
        router.refresh();
      }
      setPendingIds((ids) => { const next = new Set(ids); next.delete(dealId); return next; });
    });
  }

  const editDeal = (deal: DealRow) => { if (canEdit(deal) && deal.status === "open") setFormDeal(deal); };
  const tableDeals = deals.filter((deal) => stages.some((stage) => stage.id === deal.stage_id));

  return <div className="page-container deals-page">
    <header className="deals-header"><div><h1 className="page-title">Deals</h1><p className="page-description">Move active opportunities through your sales pipeline.</p></div><div className="deals-header-actions"><button className="deals-button deals-button-primary" disabled={!canCreate || !data.pipelineId || !stages.some(({ stage_type }) => stage_type === "open")} onClick={() => setFormDeal(null)} type="button"><Plus size={16} /> Add Deal</button></div></header>
    <form action="/app/deals" className="deals-toolbar" method="get">
      <label className="deals-search"><span className="sr-only">Search deals</span><input defaultValue={search} maxLength={100} name="q" placeholder="Search deals by name…" /><button aria-label="Search deals" className="deals-search-submit" type="submit"><Search size={15} /></button></label>
      <label className="deals-filter"><span>Pipeline</span><select defaultValue={data.pipelineId} name="pipeline" onChange={(event) => event.currentTarget.form?.requestSubmit()}>{data.pipelines.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="deals-filter"><span>Owner</span><select defaultValue={ownerFilter} name="owner" onChange={(event) => event.currentTarget.form?.requestSubmit()}><option value="">All owners</option><option value="unassigned">Unassigned</option>{data.owners.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
      <input name="view" type="hidden" value={view} />
      <div aria-label="Deal view" className="deals-view-switch" role="group"><a aria-current={view === "board" ? "page" : undefined} aria-label="Board view" className={view === "board" ? "is-current" : ""} href={viewHref("board", data.pipelineId, search, ownerFilter)}><LayoutGrid size={16} /><span>Board</span></a><a aria-current={view === "list" ? "page" : undefined} aria-label="List view" className={view === "list" ? "is-current" : ""} href={viewHref("list", data.pipelineId, search, ownerFilter)}><List size={16} /><span>List</span></a></div>
    </form>

    {notice && <p className="deals-notice" role="status">{notice}</p>}
    {!data.pipelineId ? <section className="deals-empty"><h2>No pipeline yet</h2><p>Create a pipeline in workspace settings before adding deals.</p></section> : !stages.length ? <section className="deals-empty"><h2>No active deal stages</h2><p>Activate an open stage in pipeline settings before adding or moving deals.</p></section> : !tableDeals.length ? <section className="deals-empty"><h2>{search || ownerFilter ? "No matching deals" : "Your pipeline is clear"}</h2><p>{search || ownerFilter ? "Try another search or owner filter." : "New deals will appear here when they are added to this pipeline."}</p>{canCreate && !search && !ownerFilter && <button className="deals-button deals-button-secondary" onClick={() => setFormDeal(null)} type="button"><Plus size={15} /> Add the first deal</button>}</section> : view === "board" ? <section aria-label={`${data.pipelines.find(({ id }) => id === data.pipelineId)?.name ?? "Pipeline"} stages`} className="deals-board" onDragEnd={() => setDragDeal(null)}>
      {totals.map((stage) => <div aria-label={`${stage.name}, ${stage.deals.length} deals`} className={`deals-stage stage-${stage.stage_type}`} key={stage.id} onDragOver={(event) => { if (dragDeal && stage.stage_type === "open") { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || dragDeal; if (id && stage.stage_type === "open") move(id, stage.id); setDragDeal(null); }}>
        <header className="deals-stage-header"><div><span className="deals-stage-indicator" /><h2>{stage.name}</h2><span className="deals-stage-count">{stage.deals.length}</span></div><strong>{stage.total}</strong></header>

        <div className="deals-stage-cards">{stage.deals.length ? stage.deals.map((deal) => <DealCard canEdit={canEdit(deal) && stage.stage_type === "open"} data={data} deal={deal} key={deal.id} moving={pendingIds.has(deal.id)} todayIso={todayIso} onEdit={() => editDeal(deal)} onMove={(stageId) => move(deal.id, stageId)} onDrag={setDragDeal} stages={stages} />) : <p className="deals-stage-empty">No deals in this stage</p>}</div>
      </div>)}
    </section> : <section aria-label="Deals list" className="deals-list-wrap"><table className="deals-list"><thead><tr><th scope="col">Deal</th><th scope="col">Company</th><th scope="col">Primary contact</th><th scope="col">Stage</th><th scope="col">Value</th><th scope="col">Close date</th><th scope="col">Owner</th><th scope="col">Priority</th><th scope="col">Next stage</th></tr></thead><tbody>{tableDeals.map((deal) => <tr key={deal.id}><th scope="row"><div className="deals-list-name-actions"><button className="deals-list-edit" disabled={!canEdit(deal) || deal.status !== "open"} onClick={() => editDeal(deal)} type="button">{deal.title}</button><Link aria-label={`View details for ${deal.title}`} className="deals-view-details" href={`/app/deals/${deal.id}`}>View details</Link></div></th><td>{deal.company?.name ?? "—"}</td><td>{deal.contact?.name ?? "—"}</td><td>{stages.find(({ id }) => id === deal.stage_id)?.name ?? "—"}</td><td>{money(Number(deal.amount), deal.currency)}</td><td><span>{shortDate(deal.expected_close_date)}</span><DealAttention deal={deal} todayIso={todayIso} /></td><td><OwnerDisplay ownerId={deal.owner_id} owners={data.owners} /></td><td><span className={`deals-priority priority-${deal.priority}`}>{priorityLabel[deal.priority]}</span></td><td><label className="sr-only" htmlFor={`list-move-${deal.id}`}>Move {deal.title} to stage</label><select disabled={!canEdit(deal) || pendingIds.has(deal.id) || deal.status !== "open"} id={`list-move-${deal.id}`} onChange={(event) => { if (event.target.value) move(deal.id, event.target.value); event.target.value = ""; }} value=""><option value="">Choose…</option>{stages.filter(({ stage_type, id }) => stage_type === "open" && id !== deal.stage_id).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></td></tr>)}</tbody></table></section>}

    <section aria-label="Pipeline summary" className="deals-summary"><span><strong>{deals.length}</strong> {deals.length === 1 ? "deal" : "deals"}</span><span><strong>{moneyByCurrency(deals.filter(({ status }) => status === "open"))}</strong> open value</span><span><strong>{moneyByCurrency(deals.filter(({ status }) => status === "open"), true)}</strong> weighted pipeline</span></section>
    {formDeal !== undefined && <DealForm canReassign={canReassign} currentUserId={currentUserId} data={data} deal={formDeal} onClose={() => setFormDeal(undefined)} />}
  </div>;
}

function viewHref(view: "board" | "list", pipeline: string, q: string, owner: string) {
  const params = new URLSearchParams();
  if (pipeline) params.set("pipeline", pipeline);
  if (q) params.set("q", q);
  if (owner) params.set("owner", owner);
  params.set("view", view);
  return `/app/deals?${params.toString()}`;
}
