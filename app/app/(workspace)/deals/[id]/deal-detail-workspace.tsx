"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode, type RefObject } from "react";
import { markDealLostAction, markDealWonAction, reopenDealAction, type DealActionResult } from "../actions";
import type { DealDetail } from "@/lib/deals/repository";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate, formatCalendarDateTime, type DateFormat } from "@/lib/preferences/date-format";

type Props = { detail: DealDetail; canEdit: boolean };

function currencyAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function dateLabel(dateValue: string | null, dateFormat: DateFormat) {
  return dateValue ? formatCalendarDate(dateValue, dateFormat) : "Not set";
}

function timestampLabel(timestamp: string, dateFormat: DateFormat) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Unavailable" : formatCalendarDateTime(date, dateFormat, "UTC");
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="deal-detail-property"><dt>{label}</dt><dd>{children}</dd></div>;
}

type DealOutcomeDialogProps = {
  mode: "won" | "lost" | "reopen";
  detail: DealDetail;
  pending: boolean;
  actionResult: DealActionResult | null;
  wonDate: string;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function DealOutcomeFields({ mode, detail, wonDate }: Pick<DealOutcomeDialogProps, "mode" | "detail" | "wonDate">) {
  if (mode === "won") return <>
    <label className="deals-field">Final amount<input aria-label="Final amount" min="0" name="amount" required step="0.01" type="number" defaultValue={Number(detail.deal.amount)} /></label>
    <label className="deals-field">Won date<input aria-label="Won date" name="wonDate" required type="date" defaultValue={wonDate} /></label>
    <label className="deals-field">Closing note (optional)<textarea aria-label="Closing note" maxLength={2000} name="note" rows={3} /></label>
  </>;
  if (mode === "lost") return <>
    <label className="deals-field">Lost reason<select aria-label="Lost reason" defaultValue="" name="lostReasonId" required><option disabled value="">Choose a reason</option>{detail.lostReasons.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
    <label className="deals-field">Competitor or other context (optional)<input aria-label="Competitor or other context" maxLength={200} name="competitor" /></label>
    <label className="deals-field">Closing note (optional)<textarea aria-label="Closing note" maxLength={2000} name="note" rows={3} /></label>
    <label className="deals-field">Related open tasks<select aria-label="Related open tasks" defaultValue="" name="taskChoice" required><option disabled value="">Choose how to handle them</option><option value="keep">Keep open</option><option value="complete">Mark complete</option><option value="cancel">Cancel</option></select></label>
  </>;
  return <label className="deals-field">Reopen in stage<select aria-label="Reopen in stage" defaultValue={detail.openStages[0]?.id ?? ""} name="stageId" required>{detail.openStages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function DealOutcomeDialog({ mode, detail, pending, actionResult, wonDate, dialogRef, onClose, onSubmit }: DealOutcomeDialogProps) {
  const { deal } = detail;
  return <dialog aria-labelledby="deal-outcome-title" className="deals-dialog" onClose={onClose} ref={dialogRef}>
    <form className="deals-form deal-outcome-form" onSubmit={onSubmit}>
      <header className="deals-dialog-header"><div><h2 id="deal-outcome-title">{mode === "won" ? "Mark deal won" : mode === "lost" ? "Mark deal lost" : "Reopen deal"}</h2><p>{deal.title}</p></div><button aria-label="Close dialog" className="deals-icon-button" disabled={pending} onClick={onClose} type="button">Close</button></header>
      <input name="id" type="hidden" value={deal.id} />
      <DealOutcomeFields mode={mode} detail={detail} wonDate={wonDate} />
      {actionResult && <p aria-live="polite" className={actionResult.ok ? "deal-outcome-notice" : "deal-outcome-error"} role={actionResult.ok ? "status" : "alert"}>{actionResult.message}</p>}
      <footer className="deals-form-actions"><button className="deals-button deals-button-secondary" disabled={pending} onClick={onClose} type="button">Cancel</button><button className={`deals-button ${mode === "won" ? "deal-outcome-won" : mode === "lost" ? "deal-outcome-lost" : "deals-button-primary"}`} disabled={pending} type="submit">{pending ? "Saving…" : mode === "won" ? "Mark Won" : mode === "lost" ? "Mark Lost" : "Reopen deal"}</button></footer>
    </form>
  </dialog>;
}

function DealOutcomeControls({ detail, canEdit }: { detail: DealDetail; canEdit: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"won" | "lost" | "reopen" | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<DealActionResult | null>(null);
  const [wonDate, setWonDate] = useState("");
  const { deal } = detail;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !mode) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [mode]);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setMode(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;
    const formData = new FormData(event.currentTarget);
    setActionResult(null);
    startTransition(async () => {
      try {
        const action = mode === "won" ? markDealWonAction : mode === "lost" ? markDealLostAction : reopenDealAction;
        const response = await action(formData);
        setActionResult(response);
        if (response.ok) {
          closeDialog();
          router.refresh();
        }
      } catch {
        setActionResult({ ok: false, message: "The request could not be completed. Check your connection and try again." });
      }
    });
  }

  function open(next: "won" | "lost" | "reopen") {
    setActionResult(null);
    if (next === "won") setWonDate(deal.expected_close_date ?? new Date().toISOString().slice(0, 10));
    setMode(next);
  }

  return <>
    <div aria-label="Deal outcome actions" className="deal-outcome-actions" role="group">
      {deal.status === "open" ? <>
        <button className="deals-button deal-outcome-won" disabled={!canEdit || pending} onClick={() => open("won")} title={!canEdit ? "You do not have permission to change this deal." : undefined} type="button">Mark Won</button>
        <button className="deals-button deal-outcome-lost" disabled={!canEdit || pending} onClick={() => open("lost")} title={!canEdit ? "You do not have permission to change this deal." : undefined} type="button">Mark Lost</button>
      </> : <button className="deals-button deals-button-secondary" disabled={!canEdit || pending || detail.openStages.length === 0} onClick={() => open("reopen")} title={!canEdit ? "You do not have permission to change this deal." : detail.openStages.length === 0 ? "No active open stage is available." : undefined} type="button">Reopen deal</button>}
    </div>
    {!canEdit && <p className="deal-outcome-permission">Outcome changes are unavailable because you cannot edit this deal.</p>}
    {actionResult && !mode && <p aria-live="polite" className={actionResult.ok ? "deal-outcome-notice" : "deal-outcome-error"} role={actionResult.ok ? "status" : "alert"}>{actionResult.message}</p>}
    {mode && <DealOutcomeDialog mode={mode} detail={detail} pending={pending} actionResult={actionResult} wonDate={wonDate} dialogRef={dialogRef} onClose={closeDialog} onSubmit={submit} />}
  </>;
}

export function DealDetailWorkspace({ detail, canEdit }: Props) {
  const dateFormat = useDateFormat();
  const { deal, company, contact, stage, pipeline, ownerLabel, source } = detail;
  return (
    <div className="page-container deals-page deal-detail-page">
      <nav aria-label="Breadcrumb" className="deal-detail-breadcrumb">
        <Link href="/app/deals">Deals</Link><span aria-hidden="true">/</span><span aria-current="page">{deal.title}</span>
      </nav>

      <header className="deal-detail-header">
        <div className="deal-detail-heading">
          <h1 className="page-title">{deal.title}</h1>
          <div className="deal-detail-relations">
            {company ? <Link href={`/app/companies/${company.id}`}>{company.name}</Link> : <span>No company linked</span>}
            {contact ? <><span aria-hidden="true">·</span><Link href={`/app/contacts/${contact.id}`}>{contact.full_name}</Link></> : <><span aria-hidden="true">·</span><span>No primary contact</span></>}
          </div>
        </div>
        <div className="deal-detail-header-actions"><DealOutcomeControls canEdit={canEdit} detail={detail} /><Link className="deals-button deals-button-secondary deal-detail-back" href="/app/deals">Back to Deals</Link></div>
      </header>

      <section aria-label="Deal overview" className="deal-detail-overview">
        <div><span>Deal value</span><strong>{currencyAmount(Number(deal.amount), deal.currency)}</strong></div>
        <div><span>Probability</span><strong>{deal.probability}%</strong></div>
        <div><span>Expected close</span><strong>{dateLabel(deal.expected_close_date, dateFormat)}</strong></div>
        <div><span>Stage</span><strong>{stage?.name ?? "Stage unavailable"}</strong></div>
      </section>

      <div className="deal-detail-grid">
        <section aria-labelledby="deal-summary-heading" className="deal-detail-section">
          <h2 id="deal-summary-heading">Overview</h2>
          <p className="deal-detail-description">{deal.description || "No description provided."}</p>
          <div className="deal-detail-relationships">
            <h3>Relationships</h3>
            <dl>
              <Property label="Company">{company ? <Link href={`/app/companies/${company.id}`}>{company.name}</Link> : "No company linked"}</Property>
              <Property label="Primary contact">{contact ? <Link href={`/app/contacts/${contact.id}`}>{contact.full_name}</Link> : "No primary contact"}</Property>
            </dl>
          </div>
        </section>

        <aside aria-labelledby="deal-properties-heading" className="deal-detail-section deal-detail-properties">
          <h2 id="deal-properties-heading">Properties</h2>
          <dl>
            <Property label="Stage">{stage?.name ?? "Unavailable"}</Property>
            <Property label="Pipeline">{pipeline?.name ?? "Unavailable"}</Property>
            <Property label="Deal value">{currencyAmount(Number(deal.amount), deal.currency)}</Property>
            <Property label="Probability">{deal.probability}%</Property>
            <Property label="Expected close">{dateLabel(deal.expected_close_date, dateFormat)}</Property>
            <Property label="Owner">{ownerLabel}</Property>
            <Property label="Priority">{deal.priority[0].toUpperCase() + deal.priority.slice(1)}</Property>
            <Property label="Status">{deal.status[0].toUpperCase() + deal.status.slice(1)}</Property>
            {source && <Property label="Source">{source}</Property>}
            <Property label="Created">{timestampLabel(deal.created_at, dateFormat)}</Property>
            <Property label="Last updated">{timestampLabel(deal.updated_at, dateFormat)}</Property>
          </dl>
        </aside>
      </div>

      <section aria-labelledby="deal-activity-heading" className="deal-detail-section deal-detail-activity">
        <h2 id="deal-activity-heading">Activity</h2>
        {detail.activities.length ? <ol className="deal-activity-list">{detail.activities.map((activity) => <li key={activity.id}>
          <div><strong>{activity.subject || activity.activity_type.replaceAll("_", " ")}</strong><time dateTime={activity.occurred_at}>{timestampLabel(activity.occurred_at, dateFormat)}</time></div>
          {activity.body && <p>{activity.body}</p>}
        </li>)}</ol> : <p className="deal-activity-empty">No activity recorded for this deal yet.</p>}
      </section>
    </div>
  );
}
