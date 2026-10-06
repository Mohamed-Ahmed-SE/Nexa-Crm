import "server-only";

import type { GlobalSearchItem, GlobalSearchResults } from "@/lib/search/global-search";
import { globalSearchFilters } from "@/lib/search/global-search";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;
const resultLimit = 5;

export async function searchWorkspaceRecords(supabase: Supabase, workspaceId: string, query: string): Promise<GlobalSearchResults> {
  const rows = await fetchWorkspaceSearchRows(supabase, workspaceId, globalSearchFilters(query));
  return {
    lead: rows.leads.map((lead) => mapLead(lead, query)),
    contact: rows.contacts.map(mapContact),
    company: rows.companies.map(mapCompany),
    deal: rows.deals.map(mapDeal),
  };
}

function mapLead(lead: Awaited<ReturnType<typeof fetchWorkspaceSearchRows>>["leads"][number], query: string): GlobalSearchItem {
  return {
    id: lead.id,
    name: lead.full_name,
    type: "lead",
    context: [lead.job_title, lead.company_name, lead.email].filter(Boolean).join(" · ") || "Lead",
    href: `/app/leads?q=${encodeURIComponent(query)}`,
  };
}

function mapCompany(company: Awaited<ReturnType<typeof fetchWorkspaceSearchRows>>["companies"][number]): GlobalSearchItem {
  return {
    id: company.id,
    name: company.name,
    type: "company",
    context: [company.industry, company.website].filter(Boolean).join(" · ") || "Company",
    href: `/app/companies/${company.id}`,
  };
}

async function fetchWorkspaceSearchRows(supabase: Supabase, workspaceId: string, filters: ReturnType<typeof globalSearchFilters>) {
  const [leads, contacts, companies, deals] = await Promise.all([
    supabase.from("leads").select("id, full_name, company_name, job_title, email")
      .eq("workspace_id", workspaceId).is("archived_at", null).or(filters.leads!).limit(resultLimit),
    supabase.from("contacts").select("id, first_name, last_name, email, job_title, companies(name)")
      .eq("workspace_id", workspaceId).is("archived_at", null).or(filters.contacts!).limit(resultLimit),
    supabase.from("companies").select("id, name, industry, website")
      .eq("workspace_id", workspaceId).is("archived_at", null).or(filters.companies!).limit(resultLimit),
    supabase.from("deals").select("id, title, status, company:companies(name), primary_contact:contacts(full_name)")
      .eq("workspace_id", workspaceId).is("archived_at", null).or(filters.deals!).limit(resultLimit),
  ]);

  if (leads.error || contacts.error || companies.error || deals.error) throw new Error("Unable to search records in this workspace.");
  return { leads: leads.data ?? [], contacts: contacts.data ?? [], companies: companies.data ?? [], deals: deals.data ?? [] };
}

function mapContact(contact: Awaited<ReturnType<typeof fetchWorkspaceSearchRows>>["contacts"][number]): GlobalSearchItem {
  const company = relationName(contact.companies);
  return {
    id: contact.id,
    name: `${contact.first_name} ${contact.last_name}`.trim(),
    type: "contact",
    context: [contact.job_title, company, contact.email].filter(Boolean).join(" · ") || "Contact",
    href: `/app/contacts/${contact.id}`,
  };
}

function mapDeal(deal: Awaited<ReturnType<typeof fetchWorkspaceSearchRows>>["deals"][number]): GlobalSearchItem {
  const company = relationName(deal.company);
  const contact = relationName(deal.primary_contact);
  return {
    id: deal.id,
    name: deal.title,
    type: "deal",
    context: [company, contact, deal.status].filter(Boolean).join(" · ") || "Deal",
    href: `/app/deals/${deal.id}`,
  };
}

function relationName(relation: { name?: string; full_name?: string } | Array<{ name?: string; full_name?: string }> | null) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.name ?? value?.full_name ?? "";
}

export type { GlobalSearchItem };
