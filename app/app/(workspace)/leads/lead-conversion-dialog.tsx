"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { convertLeadAction } from "./actions";
import type { LeadConversionOptions, LeadOwner, LeadRow } from "@/lib/leads/repository";

export function LeadConversionDialog({ lead, currency, options, owners, currentUserId, onClose }: {
  lead: LeadRow;
  currency: string;
  options: LeadConversionOptions;
  owners: LeadOwner[];
  currentUserId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstNameInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [contactSelected, setContactSelected] = useState(true);
  const [companySelected, setCompanySelected] = useState(Boolean(lead.company_name));
  const [dealSelected, setDealSelected] = useState(true);
  const defaultDealOwnerId = owners.some(({ id }) => id === lead.owner_id) ? lead.owner_id ?? currentUserId : currentUserId;
  const [dealOwnerId, setDealOwnerId] = useState(defaultDealOwnerId);
  const [pipelineId, setPipelineId] = useState(options.pipelineId);
  const initialStages = options.pipelines.find(({ id }) => id === options.pipelineId)?.stages ?? [];
  const [stageId, setStageId] = useState(initialStages[0]?.id ?? "");
  const stages = options.pipelines.find(({ id }) => id === pipelineId)?.stages ?? [];
  const [defaultFirstName, ...nameParts] = lead.full_name.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(defaultFirstName ?? "");
  const lastName = nameParts.join(" ");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    firstNameInput.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  function submit(formData: FormData) {
    setError("");
    formData.set("id", lead.id);
    formData.set("pipelineId", pipelineId);
    formData.set("stageId", stageId);
    startTransition(async () => {
      const conversionResponse = await convertLeadAction(formData);
      if (!conversionResponse.ok) {
        setError(conversionResponse.message ?? "Lead conversion failed. No records were created.");
        return;
      }
      dialogRef.current?.close();
      onClose();
      if (conversionResponse.dealId) router.push(`/app/deals/${conversionResponse.dealId}`);
      else router.refresh();
    });
  }

  return <dialog aria-labelledby="lead-conversion-title" className="leads-conversion-dialog" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={onClose} ref={dialogRef}>
    <header className="leads-conversion-header">
      <div><h2 id="lead-conversion-title">Convert {lead.full_name}</h2><p>Choose which records to create. The lead and its history will be retained.</p></div>
      <button aria-label="Close conversion" className="leads-icon-button" disabled={pending} onClick={() => dialogRef.current?.close()} type="button"><X size={17} /></button>
    </header>
    <form action={submit} className="leads-conversion-form">
      <fieldset className="leads-conversion-choices">
        <legend>Create records</legend>
        <label><input checked={contactSelected} name="createContact" onChange={(event) => setContactSelected(event.target.checked)} type="checkbox" /> Contact</label>
        <label><input checked={companySelected} name="createCompany" onChange={(event) => setCompanySelected(event.target.checked)} type="checkbox" /> Company</label>
        <label><input checked={dealSelected} name="createDeal" onChange={(event) => setDealSelected(event.target.checked)} type="checkbox" /> Deal</label>
      </fieldset>
      {contactSelected && <div className="leads-form-grid">
        <label className="leads-field">First name<input maxLength={100} name="contactFirstName" ref={firstNameInput} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
        <label className="leads-field">Last name<input defaultValue={lastName} maxLength={100} name="contactLastName" required /></label>
      </div>}
      {companySelected && <label className="leads-field">Company name<input defaultValue={lead.company_name ?? ""} maxLength={200} name="companyName" required /></label>}
      {dealSelected && <div className="leads-form-grid">
        <label className="leads-field">Deal name<input defaultValue={lead.company_name ? `${lead.company_name} opportunity` : `${lead.full_name} opportunity`} maxLength={200} name="dealTitle" required /></label>
        <label className="leads-field">Pipeline<select disabled={!options.pipelines.length} onChange={(event) => { const nextPipelineId = event.target.value; setPipelineId(nextPipelineId); setStageId(options.pipelines.find(({ id }) => id === nextPipelineId)?.stages[0]?.id ?? ""); }} required value={pipelineId}>{options.pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
        <label className="leads-field">Initial stage<select disabled={!stages.length} onChange={(event) => setStageId(event.target.value)} required value={stageId}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
        <label className="leads-field">Deal value ({currency})<input defaultValue={lead.estimated_value} min="0" name="dealValue" required step="0.01" type="number" /></label>
        <label className="leads-field">Expected close date<input name="closeDate" type="date" /></label>
        <label className="leads-field">Deal owner<select name="dealOwnerId" onChange={(event) => setDealOwnerId(event.target.value)} required value={dealOwnerId}>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></label>
        {!stages.length && <p className="leads-form-message">No active open stage is available for this pipeline. Choose another pipeline or create a contact or company.</p>}
      </div>}
      <p aria-live="polite" className="leads-form-message" role={error ? "alert" : undefined}>{error}</p>
      <footer className="leads-form-footer">
        <button className="leads-secondary-button" disabled={pending} onClick={() => dialogRef.current?.close()} type="button">Cancel</button>
        <button className="leads-primary-button" disabled={pending} type="submit">{pending ? "Converting…" : "Convert lead"}</button>
      </footer>
    </form>
  </dialog>;
}
