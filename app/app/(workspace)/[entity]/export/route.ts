import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { parseLeadSearchParams, buildLeadSearchFilter } from "@/lib/leads/schema";
import { parseContactSearchParams } from "@/lib/contacts/schema";
import { parseCompanySearchParams, escapeCompanySearchTerm } from "@/lib/companies/schema";
import { serializeCsv } from "@/lib/csv/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const csvColumns = {
  leads: { headers: ["Name", "Company", "Email", "Phone", "Job title", "Source", "Status", "Owner ID", "Estimated value", "Currency", "Notes", "Created at", "Updated at"], keys: ["full_name", "company_name", "email", "phone", "job_title", "source_name", "status", "owner_id", "estimated_value", "currency", "notes_summary", "created_at", "updated_at"] },
  contacts: { headers: ["First name", "Last name", "Email", "Phone", "Job title", "Company", "Owner ID", "Lifecycle", "LinkedIn URL", "Created at", "Updated at"], keys: ["first_name", "last_name", "email", "phone", "job_title", "company_name", "owner_id", "lifecycle_status", "linkedin_url", "created_at", "updated_at"] },
  companies: { headers: ["Name", "Website", "Industry", "Employee size", "Phone", "Address line 1", "Address line 2", "City", "State", "Postal code", "Country", "Description", "Owner ID", "Created at", "Updated at"], keys: ["name", "website", "industry", "employee_size", "phone", "address_line_1", "address_line_2", "city", "state", "postal_code", "country", "description", "owner_id", "created_at", "updated_at"] },
} as const;
type Entity = keyof typeof csvColumns;
type DataRow = Record<string, unknown>;

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(entity in csvColumns)) return new Response("Not found", { status: 404 });
  const context = await requirePermission("data.export");
  if (!hasWorkspacePermission(context.role, "crm.view")) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Authentication is not configured.", { status: 503 });
  const filterParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  try {
    const records = await loadExportRows(supabase, context.workspaceId, entity as Entity, filterParams);
    const { headers, keys } = csvColumns[entity as Entity];
    const body = `\uFEFF${serializeCsv([...headers], records.map((record) => keys.map((key) => record[key])))}`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nexa-${entity}-${date}.csv"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("The filtered export could not be prepared.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

async function loadExportRows(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, entity: Entity, raw: Record<string, string>): Promise<DataRow[]> {
  if (entity === "leads") {
    const params = parseLeadSearchParams(raw);
    return fetchAll((from, to) => {
      let query = supabase.from("leads").select("id, full_name, company_name, email, phone, job_title, source_id, status, owner_id, estimated_value, currency, notes_summary, created_at, updated_at, lead_sources(name)").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").order("id").range(from, to);
      if (params.status !== "all") query = query.eq("status", params.status);
      if (params.sourceId) query = query.eq("source_id", params.sourceId);
      if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
      const filter = buildLeadSearchFilter(params.q); if (filter) query = query.or(filter);
      return query;
    }, (row) => ({ ...row, source_name: Array.isArray(row.lead_sources) ? row.lead_sources[0]?.name ?? "" : (row.lead_sources as { name?: string } | null)?.name ?? "" }));
  }
  if (entity === "contacts") {
    const params = parseContactSearchParams(raw);
    return fetchAll((from, to) => {
      let query = supabase.from("contacts").select("id, first_name, last_name, email, phone, job_title, company_id, companies(name, archived_at), owner_id, lifecycle_status, linkedin_url, created_at, updated_at").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").order("id").range(from, to);
      if (params.lifecycle !== "all") query = query.eq("lifecycle_status", params.lifecycle);
      if (params.companyId) query = query.eq("company_id", params.companyId);
      if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
      return query;
    }, (row) => {
      const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as { name?: string; archived_at?: string | null } | null;
      return { ...row, company_name: company?.name ?? "", company_search_name: company && !company.archived_at ? company.name ?? "" : "" };
    }, params.q ? (row) => hasSearchMatch(row, ["first_name", "last_name", "email", "phone", "job_title", "company_search_name"], params.q) : undefined);
  }
  const params = parseCompanySearchParams(raw);
  const matchingCompanyIds = new Set<string>();
  if (params.q) {
    const term = escapeCompanySearchTerm(params.q);
    const matches = await fetchAll((from, to) => supabase.from("contacts").select("id, company_id").eq("workspace_id", workspaceId).is("archived_at", null).or(`first_name.ilike."%${term}%",last_name.ilike."%${term}%",email.ilike."%${term}%`).order("id").range(from, to));
    for (const match of matches) if (typeof match.company_id === "string") matchingCompanyIds.add(match.company_id);
  }
  return fetchAll((from, to) => {
    let query = supabase.from("companies").select("id, name, website, industry, employee_size, phone, address_line_1, address_line_2, city, state, postal_code, country, description, owner_id, created_at, updated_at").eq("workspace_id", workspaceId).is("archived_at", null).order("name").order("id").range(from, to);
    if (params.ownerId === "unassigned") query = query.is("owner_id", null); else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
    return query;
  }, (row) => row, params.q ? (row) => matchingCompanyIds.has(String(row.id)) || hasSearchMatch(row, ["name", "industry", "website", "phone"], params.q) : undefined);
}

async function fetchAll(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, transform: (row: DataRow) => DataRow = (row) => row, include: (row: DataRow) => boolean = () => true): Promise<DataRow[]> {
  const result: DataRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await fetchPage(offset, offset + 999);
    if (page.error) throw page.error;
    const rows = (page.data ?? []) as DataRow[];
    for (const row of rows.map(transform)) if (include(row)) result.push(row);
    if (rows.length < 1000) return result;
  }
}

function hasSearchMatch(row: DataRow, fields: string[], query: string) {
  const term = query.trim().toLowerCase();
  return fields.some((field) => String(row[field] ?? "").toLowerCase().includes(term));
}
