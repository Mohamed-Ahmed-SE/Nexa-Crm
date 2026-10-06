import "server-only";
import { buildCompanySearchFilter, companyPageSize, escapeCompanySearchTerm, type CompanySearchParams } from "@/lib/companies/schema";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;
type CompanyRecord = {
  id: string; workspace_id: string; name: string; website: string | null; industry: string | null; employee_size: number | null;
  phone: string | null; address_line_1: string | null; address_line_2: string | null; city: string | null; state: string | null;
  postal_code: string | null; country: string | null; description: string | null; owner_id: string | null; created_at: string;
  updated_at: string; archived_at: string | null;
};
export type CompanyOwner = { id: string; label: string };
export type CompanyListRow = CompanyRecord & { ownerLabel: string; contactsCount: number; openDealsCount: number; openPipelineValue: number; currency: string | null; lastActivity: string | null; nextActivity: string | null };
export type CompanyDetail = {
  company: CompanyRecord; ownerLabel: string; contacts: { id: string; first_name: string; last_name: string; email: string | null; job_title: string | null; owner_id: string | null }[];
  deals: { id: string; title: string; amount: number; currency: string; status: string; expected_close_date: string | null; stage: { name: string } | null }[];
  activities: { id: string; activity_type: string; subject: string | null; body: string | null; occurred_at: string; created_by: string }[];
  tasks: { id: string; title: string; description: string | null; task_type: string; status: string; priority: string; due_at: string | null; assigned_to: string | null; created_by: string }[];
  notes: { id: string; body: string; is_pinned: boolean; created_by: string; created_at: string }[];
  attachments: { id: string; filename: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at: string }[];
};

function assertQueries(results: { error: { message: string } | null }[]) {
  if (results.some(({ error }) => error)) throw new Error("Unable to load company records for this workspace.");
}

function ownerLabel(ownerId: string | null, owners: CompanyOwner[]) {
  return ownerId ? owners.find((owner) => owner.id === ownerId)?.label ?? `Workspace member · ${ownerId.slice(0, 6)}` : "Unassigned";
}

export async function listCompanyOptions(supabase: Supabase, workspaceId: string, userId: string, fullName: string) {
  const [members, companyResult] = await Promise.all([
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
    supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
  ]);
  if (members.error || companyResult.error) throw new Error("Unable to load company options.");
  const owners = ((members.data ?? []) as { user_id: string }[]).map(({ user_id }) => ({
    id: user_id,
    label: user_id === userId ? fullName : `Workspace member · ${user_id.slice(0, 6)}`,
  }));
  return { owners, companies: companyResult.data ?? [] };
}

export async function listWorkspaceCompanies(supabase: Supabase, workspaceId: string, userId: string, fullName: string, params: CompanySearchParams) {
  const start = (params.page - 1) * companyPageSize;
  let query = supabase.from("companies").select("id, workspace_id, name, website, industry, employee_size, phone, address_line_1, address_line_2, city, state, postal_code, country, description, owner_id, created_at, updated_at, archived_at", { count: "exact" })
    .eq("workspace_id", workspaceId).is("archived_at", null).order("name").range(start, start + companyPageSize - 1);
  if (params.ownerId === "unassigned") query = query.is("owner_id", null);
  else if (params.ownerId) query = query.eq("owner_id", params.ownerId);
  if (params.q) {
    const contactMatches = await supabase.from("contacts").select("company_id").eq("workspace_id", workspaceId).is("archived_at", null).or(`first_name.ilike."%${escapeCompanySearchTerm(params.q)}%",last_name.ilike."%${escapeCompanySearchTerm(params.q)}%",email.ilike."%${escapeCompanySearchTerm(params.q)}%`);
    if (contactMatches.error) throw new Error("Unable to search workspace contacts.");
    const relatedCompanyIds = [...new Set((contactMatches.data ?? []).map((contact) => contact.company_id).filter(Boolean))];
    const compoundSearch = [buildCompanySearchFilter(params.q)];
    if (relatedCompanyIds.length) compoundSearch.push(`id.in.(${relatedCompanyIds.join(",")})`);
    query = query.or(compoundSearch.filter((filter): filter is string => filter !== null).join(","));

  }
  const [records, total, ownersResult] = await Promise.all([
    query,
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  assertQueries([records, total, ownersResult]);
  const companies = (records.data ?? []) as CompanyRecord[];
  const companyIds = companies.map(({ id }) => id);
  const related = companyIds.length ? await Promise.all([
    supabase.from("contacts").select("company_id").eq("workspace_id", workspaceId).in("company_id", companyIds).is("archived_at", null),
    supabase.from("deals").select("company_id, amount, currency").eq("workspace_id", workspaceId).in("company_id", companyIds).eq("status", "open").is("archived_at", null),
    supabase.from("activities").select("related_entity_id, occurred_at").eq("workspace_id", workspaceId).eq("related_entity_type", "company").in("related_entity_id", companyIds).lte("occurred_at", new Date().toISOString()).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("related_entity_id, due_at").eq("workspace_id", workspaceId).eq("related_entity_type", "company").eq("status", "open").in("related_entity_id", companyIds).not("due_at", "is", null).gte("due_at", new Date().toISOString()).order("due_at"),
  ]) : [];
  assertQueries(related);
  const contactCounts = new Map<string, number>();
  for (const contact of (related[0]?.data ?? []) as { company_id: string | null }[]) if (contact.company_id) contactCounts.set(contact.company_id, (contactCounts.get(contact.company_id) ?? 0) + 1);
  const deals = (related[1]?.data ?? []) as { company_id: string | null; amount: number; currency: string }[];
  const dealMetrics = new Map<string, { count: number; value: number; currency: string | null }>();
  for (const deal of deals) if (deal.company_id) {
    const prior = dealMetrics.get(deal.company_id);
    if (!prior) dealMetrics.set(deal.company_id, { count: 1, value: Number(deal.amount), currency: deal.currency });
    else if (!prior.currency || prior.currency !== deal.currency) dealMetrics.set(deal.company_id, { count: prior.count + 1, value: 0, currency: null });
    else dealMetrics.set(deal.company_id, { count: prior.count + 1, value: prior.value + Number(deal.amount), currency: prior.currency });
  }
  const latestActivity = new Map<string, string>();
  for (const activity of (related[2]?.data ?? []) as { related_entity_id: string; occurred_at: string }[]) if (!latestActivity.has(activity.related_entity_id)) latestActivity.set(activity.related_entity_id, activity.occurred_at);
  const nextTask = new Map<string, string>();
  for (const task of (related[3]?.data ?? []) as { related_entity_id: string; due_at: string }[]) if (!nextTask.has(task.related_entity_id)) nextTask.set(task.related_entity_id, task.due_at);
  const owners = ((ownersResult.data ?? []) as { user_id: string }[]).map(({ user_id }) => ({ id: user_id, label: user_id === userId ? fullName : `Workspace member · ${user_id.slice(0, 6)}` }));
  return {
    companies: companies.map((company) => {
      const dealsForCompany = dealMetrics.get(company.id);
      return { ...company, ownerLabel: ownerLabel(company.owner_id, owners), contactsCount: contactCounts.get(company.id) ?? 0, openDealsCount: dealsForCompany?.count ?? 0, openPipelineValue: dealsForCompany?.value ?? 0, currency: dealsForCompany?.currency ?? "USD", lastActivity: latestActivity.get(company.id) ?? null, nextActivity: nextTask.get(company.id) ?? null };
    }) as CompanyListRow[],
    matchedCount: records.count ?? 0,
    totalCount: total.count ?? 0,
    owners,
  };
}

export async function getCompany(supabase: Supabase, workspaceId: string, id: string, includeArchived = false) {
  let query = supabase.from("companies").select("id, workspace_id, name, website, industry, employee_size, phone, address_line_1, address_line_2, city, state, postal_code, country, description, owner_id, created_at, updated_at, archived_at").eq("workspace_id", workspaceId).eq("id", id);
  if (!includeArchived) query = query.is("archived_at", null);
  return query.maybeSingle();
}

export async function getCompanyDetail(supabase: Supabase, workspaceId: string, id: string): Promise<CompanyDetail | null> {
  const [companyResult, contacts, deals, activities, tasks, notes, attachments, ownersResult] = await Promise.all([
    getCompany(supabase, workspaceId, id),
    supabase.from("contacts").select("id, first_name, last_name, email, job_title, owner_id").eq("workspace_id", workspaceId).eq("company_id", id).is("archived_at", null).order("last_name").order("first_name"),
    supabase.from("deals").select("id, title, amount, currency, status, expected_close_date, stage:pipeline_stages(name)").eq("workspace_id", workspaceId).eq("company_id", id).is("archived_at", null).order("updated_at", { ascending: false }),
    supabase.from("activities").select("id, activity_type, subject, body, occurred_at, created_by").eq("workspace_id", workspaceId).eq("related_entity_type", "company").eq("related_entity_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, description, task_type, status, priority, due_at, assigned_to, created_by").eq("workspace_id", workspaceId).eq("related_entity_type", "company").eq("related_entity_id", id).order("due_at", { ascending: true }),
    supabase.from("notes").select("id, body, is_pinned, created_by, created_at").eq("workspace_id", workspaceId).eq("related_entity_type", "company").eq("related_entity_id", id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("attachments").select("id, filename, mime_type, size_bytes, uploaded_by, created_at").eq("workspace_id", workspaceId).eq("related_entity_type", "company").eq("related_entity_id", id).order("created_at", { ascending: false }),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  if (companyResult.error) throw new Error("Unable to load this company.");
  if (!companyResult.data) return null;
  assertQueries([contacts, deals, activities, tasks, notes, attachments, ownersResult]);
  const owners = ((ownersResult.data ?? []) as { user_id: string }[]).map(({ user_id }) => ({ id: user_id, label: `Workspace member · ${user_id.slice(0, 6)}` }));
  return {
    company: companyResult.data as CompanyRecord,
    ownerLabel: ownerLabel(companyResult.data.owner_id, owners),
    contacts: contacts.data ?? [], deals: (deals.data ?? []) as unknown as CompanyDetail["deals"], activities: activities.data ?? [],
    tasks: tasks.data ?? [], notes: notes.data ?? [], attachments: attachments.data ?? [],
  };
}
