import { z } from "zod";
import { buildCompanySearchFilter } from "@/lib/companies/schema";
import { buildContactSearchFilter } from "@/lib/contacts/schema";
import { buildDealSearchFilter } from "@/lib/deals/schema";
import { buildLeadSearchFilter } from "@/lib/leads/schema";

const globalSearchInputSchema = z.string().trim().min(1).max(100);

export type GlobalSearchKind = "lead" | "contact" | "company" | "deal";
export type GlobalSearchItem = {
  id: string;
  name: string;
  type: GlobalSearchKind;
  context: string;
  href: string;
};
export type GlobalSearchResults = Record<GlobalSearchKind, GlobalSearchItem[]>;

export function parseGlobalSearchInput(input: unknown): string | null {
  const parsed = globalSearchInputSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function emptyGlobalSearchResults(): GlobalSearchResults {
  return { lead: [], contact: [], company: [], deal: [] };
}

export function globalSearchFilters(query: string) {
  return {
    leads: buildLeadSearchFilter(query),
    contacts: buildContactSearchFilter(query),
    companies: buildCompanySearchFilter(query),
    deals: buildDealSearchFilter(query),
  };
}
