import Link from "next/link";
import type { ReactNode } from "react";
import type { LeadDetail } from "@/lib/leads/repository";

const statusLabels: Record<LeadDetail["lead"]["status"], string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
};

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="contact-property"><span>{label}</span><div>{children}</div></div>;
}

export function LeadDetailWorkspace({ detail }: { detail: LeadDetail }) {
  const { lead, source, ownerLabel } = detail;
  const createdAt = formatTimestamp(lead.created_at);
  const updatedAt = formatTimestamp(lead.updated_at);

  return <main className="page-container leads-page contact-detail-page">
    <div className="contact-breadcrumb"><nav aria-label="Breadcrumb"><Link href="/app/leads">← Back to Leads</Link></nav></div>
    <section className="contact-hero">
      <div className="contact-hero-copy">
        <div className="contact-name-line"><h1>{lead.full_name}</h1><span className="contact-deal-status">{statusLabels[lead.status]}</span></div>
        {lead.company_name && <p>{lead.company_name}</p>}
      </div>
    </section>
    <div className="contact-detail-grid">
      <div className="contact-detail-main">
        <section aria-label="Lead information" className="contact-section">
          <h2 className="contact-section-heading">Lead information</h2>
          {lead.job_title && <Property label="Job title">{lead.job_title}</Property>}
          {lead.email && <Property label="Email"><a href={`mailto:${lead.email}`}>{lead.email}</a></Property>}
          {lead.phone && <Property label="Phone"><a href={`tel:${lead.phone}`}>{lead.phone}</a></Property>}
          {lead.notes_summary && <Property label="Notes summary">{lead.notes_summary}</Property>}
          {!lead.job_title && !lead.email && !lead.phone && !lead.notes_summary && <p className="contact-muted">No additional information is recorded for this lead.</p>}
        </section>
      </div>
      <aside aria-label="Lead properties" className="contact-detail-rail">
        <section className="contact-rail-section">
          <h2 className="contact-section-heading">Properties</h2>
          <Property label="Estimated value">{formatCurrency(Number(lead.estimated_value), lead.currency)}</Property>
          {ownerLabel && <Property label="Owner">{ownerLabel}</Property>}
          {source && <Property label="Source">{source}</Property>}
          {createdAt && <Property label="Created"><time dateTime={lead.created_at}>{createdAt}</time></Property>}
          {updatedAt && <Property label="Updated"><time dateTime={lead.updated_at}>{updatedAt}</time></Property>}
        </section>
      </aside>
    </div>
  </main>;
}
