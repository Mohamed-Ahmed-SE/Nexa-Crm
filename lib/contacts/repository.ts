import "server-only";

import { buildContactSearchFilter, contactPageSize, contactSortOrder, escapeContactSearchTerm, parsePersistedContactView } from "@/lib/contacts/schema";
import type { ContactSearchParams, ContactViewSort, ContactViewColumn } from "@/lib/contacts/schema";

export type ContactOwner = { id: string; label: string };
export type ContactCompany = { id: string; name: string; industry: string | null; employee_size: number | null; description: string | null; archived_at: string | null };
export type ContactRow = {
  id: string; workspace_id: string; company_id: string | null; first_name: string; last_name: string; email: string | null;
  phone: string | null; job_title: string | null; linkedin_url: string | null; owner_id: string | null;
  lifecycle_status: "active" | "inactive" | "customer" | "former_customer"; created_at: string; updated_at: string;
  company?: ContactCompany | null;
};
export type ContactTag = { id: string; name: string; color_token: string | null };
export type ContactListRow = ContactRow & { lastActivity: string | null; nextActivity: string | null; tags: ContactTag[] };
export type ContactDeal = { id: string; title: string; amount: number; currency: string; status: string; expected_close_date: string | null; stage: { name: string } | null };
export type ContactActivity = { id: string; activity_type: string; subject: string | null; body: string | null; occurred_at: string; created_by: string; owner_id: string | null };
export type ContactTask = { id: string; title: string; description: string | null; task_type: string; status: string; priority: string; due_at: string | null; assigned_to: string | null; created_by: string; completed_at: string | null };
export type ContactNote = { id: string; body: string; is_pinned: boolean; created_by: string; created_at: string; updated_at: string };
export type ContactAttachment = { id: string; filename: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at: string; storage_path: string };

const lifecycleCounts = ["active", "customer"] as const;

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

export async function listWorkspaceContacts(
  supabase: Supabase,
  workspaceId: string,
  currentUserId: string,
  currentUserName: string,
  params: ContactSearchParams,
) {
  const start = (params.page - 1) * contactPageSize;
  const companyIds = params.q
    ? await supabase.from("companies").select("id").eq("workspace_id", workspaceId).ilike("name", `%${escapeContactSearchTerm(params.q)}%`)
    : { data: [], error: null };
  if (companyIds.error) throw new Error("Unable to search workspace companies.");
  let recordsQuery = supabase.from("contacts")
    .select("id, workspace_id, company_id, first_name, last_name, email, phone, job_title, linkedin_url, owner_id, lifecycle_status, created_at, updated_at, companies(id, name, industry, employee_size, description, archived_at)", { count: "exact" })
    .eq("workspace_id", workspaceId).is("archived_at", null);
  if (params.lifecycle !== "all") recordsQuery = recordsQuery.eq("lifecycle_status", params.lifecycle);
  if (params.companyId) recordsQuery = recordsQuery.eq("company_id", params.companyId);
  if (params.ownerId === "unassigned") recordsQuery = recordsQuery.is("owner_id", null);
  else if (params.ownerId) recordsQuery = recordsQuery.eq("owner_id", params.ownerId);
  const searchFilter = buildContactSearchFilter(params.q);
  const companyFilter = companyIds.data?.length ? `company_id.in.(${companyIds.data.map(({ id }) => id).join(",")})` : null;
  const searchFilters = [searchFilter, companyFilter].filter(Boolean);
  if (searchFilters.length) recordsQuery = recordsQuery.or(searchFilters.join(","));
  for (const order of contactSortOrder(params.sort)) recordsQuery = recordsQuery.order(order.column, { ascending: order.ascending });
  recordsQuery = recordsQuery.range(start, start + contactPageSize - 1);

  const [records, total, active, customer, companiesResult, ownerResult] = await Promise.all([
    recordsQuery,
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("lifecycle_status", lifecycleCounts[0]).is("archived_at", null),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("lifecycle_status", lifecycleCounts[1]).is("archived_at", null),
    supabase.from("companies").select("id, name, industry, employee_size, description, archived_at").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  if (records.error || total.error || active.error || customer.error || companiesResult.error || ownerResult.error) throw new Error("Unable to load contacts for this workspace.");
  const owners: ContactOwner[] = (ownerResult.data ?? []).map(({ user_id }: { user_id: string }) => ({
    id: user_id,
    label: user_id === currentUserId ? currentUserName : `Workspace member · ${user_id.slice(0, 6)}`,
  }));
  const pageContacts = records.data ?? [];
  const contactIds = pageContacts.map(({ id }) => id);
  const now = new Date().toISOString();
  const related = contactIds.length ? await Promise.all([
    supabase.from("activities").select("related_entity_id, occurred_at").eq("workspace_id", workspaceId).eq("related_entity_type", "contact").in("related_entity_id", contactIds).lte("occurred_at", now).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("related_entity_id, due_at").eq("workspace_id", workspaceId).eq("related_entity_type", "contact").eq("status", "open").in("related_entity_id", contactIds).not("due_at", "is", null).gte("due_at", now).order("due_at"),
    supabase.from("entity_tags").select("entity_id, tags(id, name, color_token)").eq("workspace_id", workspaceId).eq("entity_type", "contact").in("entity_id", contactIds),
  ]) : [];
  if (related.some(({ error }) => error)) throw new Error("Unable to load contact activity and tags for this workspace.");
  const lastActivityByContact = new Map<string, string>();
  for (const activity of (related[0]?.data ?? []) as { related_entity_id: string; occurred_at: string }[]) {
    if (!lastActivityByContact.has(activity.related_entity_id)) lastActivityByContact.set(activity.related_entity_id, activity.occurred_at);
  }
  const nextActivityByContact = new Map<string, string>();
  for (const task of (related[1]?.data ?? []) as { related_entity_id: string; due_at: string }[]) {
    if (!nextActivityByContact.has(task.related_entity_id)) nextActivityByContact.set(task.related_entity_id, task.due_at);
  }
  const tagsByContact = new Map<string, ContactTag[]>();
  for (const { entity_id, tags } of (related[2]?.data ?? []) as { entity_id: string; tags: ContactTag[] | null }[]) {
    if (tags?.length) tagsByContact.set(entity_id, [...(tagsByContact.get(entity_id) ?? []), ...tags]);
  }
  return {
    contacts: pageContacts.map((row) => ({
      ...row,
      company: Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies,
      lastActivity: lastActivityByContact.get(row.id) ?? null,
      nextActivity: nextActivityByContact.get(row.id) ?? null,
      tags: tagsByContact.get(row.id) ?? [],
    })) as ContactListRow[],
    matchedCount: records.count ?? 0,
    totalCount: total.count ?? 0,
    activeCount: active.count ?? 0,
    customerCount: customer.count ?? 0,
    companies: companiesResult.data as ContactCompany[],
    owners,
  };
}

export type ContactSavedView = {
  id: string;
  name: string;
  filters: Pick<ContactSearchParams, "q" | "lifecycle" | "companyId" | "ownerId">;
  sort: ContactViewSort;
  visibleColumns: ContactViewColumn[];
};

export async function listContactSavedViews(supabase: Supabase, workspaceId: string, userId: string): Promise<ContactSavedView[]> {
  const { data, error } = await supabase.from("saved_views")
    .select("id, name, filters, sort, visible_columns")
    .eq("workspace_id", workspaceId).eq("user_id", userId).eq("entity_type", "contacts").order("name");
  if (error) throw new Error("Unable to load saved contact views.");
  return (data ?? []).flatMap((row) => {
    const parsed = parsePersistedContactView(row);
    return parsed ? [{ id: row.id, name: row.name, ...parsed }] : [];
  });
}

export async function getContact(supabase: Supabase, workspaceId: string, id: string) {
  return supabase.from("contacts").select("id, workspace_id, company_id, first_name, last_name, email, phone, job_title, linkedin_url, owner_id, lifecycle_status, created_at, updated_at")
    .eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).maybeSingle();
}

export async function getContactDetail(supabase: Supabase, workspaceId: string, id: string, activityPage = 1) {
  const activityStart = (activityPage - 1) * contactPageSize;
  const [contactResult, dealsResult, activitiesResult, tasksResult, notesResult, filesResult] = await Promise.all([
    getContact(supabase, workspaceId, id),
    supabase.from("deals").select("id, title, amount, currency, status, expected_close_date, stage:pipeline_stages(name)").eq("workspace_id", workspaceId).eq("primary_contact_id", id).is("archived_at", null).order("updated_at", { ascending: false }),
    supabase.from("activities").select("id, activity_type, subject, body, occurred_at, created_by, owner_id", { count: "exact" }).eq("workspace_id", workspaceId).eq("related_entity_type", "contact").eq("related_entity_id", id).order("occurred_at", { ascending: false }).range(activityStart, activityStart + contactPageSize - 1),
    supabase.from("tasks").select("id, title, description, task_type, status, priority, due_at, assigned_to, created_by, completed_at").eq("workspace_id", workspaceId).eq("related_entity_type", "contact").eq("related_entity_id", id).order("due_at", { ascending: true }),
    supabase.from("notes").select("id, body, is_pinned, created_by, created_at, updated_at").eq("workspace_id", workspaceId).eq("related_entity_type", "contact").eq("related_entity_id", id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("attachments").select("id, filename, mime_type, size_bytes, uploaded_by, created_at, storage_path").eq("workspace_id", workspaceId).eq("related_entity_type", "contact").eq("related_entity_id", id).order("created_at", { ascending: false }),
  ]);
  if (contactResult.error) throw new Error("Unable to load this contact.");
  if (!contactResult.data) return null;
  const contact = contactResult.data as ContactRow;
  const companyResult = contact.company_id
    ? await supabase.from("companies").select("id, name, website, industry, employee_size, phone, city, state, country, description, owner_id, archived_at").eq("workspace_id", workspaceId).eq("id", contact.company_id).maybeSingle()
    : { data: null, error: null };
  if (companyResult.error || dealsResult.error || activitiesResult.error || tasksResult.error || notesResult.error || filesResult.error) throw new Error("Unable to load contact activity and related records.");
  return {
    contact,
    company: companyResult.data,
    deals: (dealsResult.data ?? []) as unknown as ContactDeal[],
    activities: (activitiesResult.data ?? []) as ContactActivity[],
    activityCount: activitiesResult.count ?? 0,
    tasks: (tasksResult.data ?? []) as ContactTask[],
    notes: (notesResult.data ?? []) as ContactNote[],
    attachments: (filesResult.data ?? []) as ContactAttachment[],
  };
}

export async function getContactForEdit(supabase: Supabase, workspaceId: string, id: string) {
  return supabase.from("contacts").select("id, workspace_id, company_id, first_name, last_name, email, phone, job_title, linkedin_url, owner_id, lifecycle_status")
    .eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null).maybeSingle();
}

export async function listContactFormOptions(supabase: Supabase, workspaceId: string, currentUserId: string, currentUserName: string) {
  const [companies, owners] = await Promise.all([
    supabase.from("companies").select("id, name, archived_at").eq("workspace_id", workspaceId).is("archived_at", null).order("name"),
    supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: null, target_lead_id: null }),
  ]);
  if (companies.error || owners.error) throw new Error("Unable to load contact options.");
  return {
    companies: companies.data ?? [],
    owners: (owners.data ?? []).map(({ user_id }: { user_id: string }) => ({ id: user_id, label: user_id === currentUserId ? currentUserName : `Workspace member · ${user_id.slice(0, 6)}` })) as ContactOwner[],
  };
}
