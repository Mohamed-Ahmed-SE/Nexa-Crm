"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import type { WorkspaceContext } from "@/lib/auth/context";
import { importEntities, validateImportRow, type ImportEntity } from "@/lib/csv/import";
import { isImportPayloadWithinLimit } from "@/lib/csv/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RowFailure = { row: number; errors: string[] };
type ImportResult = { ok: boolean; message: string; imported: number; rejected: number; errors: RowFailure[] };
type ImportRows = Record<string, unknown>[];
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type ImportRequest = { valid: true; entity: ImportEntity; rows: ImportRows } | { valid: false; result: ImportResult };
type ImportSummary = { imported: number; failures: RowFailure[] };
type ImportExecution = { supabase: Supabase; context: WorkspaceContext; entity: ImportEntity; canReassign: boolean; currency: string };
export async function importCsvAction(formData: FormData): Promise<ImportResult> {
  const context = await requirePermission("data.import");
  if (!hasWorkspacePermission(context.role, "crm.create")) throw new Error("Import permission requires CRM create access.");
  const request = parseImportRequest(formData);
  if (!request.valid) return request.result;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Authentication is not configured.");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const rowsResult = await importRows({ supabase, context, entity: request.entity, canReassign }, request.rows);
  if (!rowsResult) return failure("Workspace settings could not be verified. No rows were imported.");
  const historySaved = await saveImportHistory({ supabase, context, entity: request.entity }, rowsResult, request.rows.length);
  if (!historySaved) return { ok: false, message: "Rows were processed, but import history could not be recorded. Contact your administrator.", imported: rowsResult.imported, rejected: rowsResult.failures.length, errors: rowsResult.failures };
  for (const path of ["/app/leads", "/app/contacts", "/app/companies", "/app/data-import"]) revalidatePath(path);
  return { ok: true, message: `Import finished: ${rowsResult.imported} imported, ${rowsResult.failures.length} need attention.`, imported: rowsResult.imported, rejected: rowsResult.failures.length, errors: rowsResult.failures };
}

function parseImportRequest(formData: FormData): ImportRequest {
  const entity = formData.get("entity");
  const payload = formData.get("rows");
  if (typeof entity !== "string" || !importEntities.includes(entity as ImportEntity) || typeof payload !== "string") {
    return { valid: false, result: failure("The import is invalid. Choose a CSV file under 5 MB.") };
  }
  if (!isImportPayloadWithinLimit(payload)) {
    return { valid: false, result: failure("Mapped import data exceeds 32 MB. Split the CSV into smaller files and try again.") };
  }
  let rows: unknown;
  try { rows = JSON.parse(payload); } catch { return { valid: false, result: failure("The mapped CSV could not be read. Review the file and try again.") }; }
  if (!Array.isArray(rows) || rows.length > 10_000 || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    return { valid: false, result: failure("The import must contain up to 10,000 valid rows.") };
  }
  return { valid: true, entity: entity as ImportEntity, rows: rows as ImportRows };
}

async function importRows(execution: Omit<ImportExecution, "currency">, rows: ImportRows): Promise<ImportSummary | null> {
  const currency = await getDefaultCurrency(execution.supabase, execution.context.workspaceId, execution.entity);
  if (currency === null) return null;
  const importExecution = { ...execution, currency };
  const failures: RowFailure[] = [];
  let imported = 0;
  for (const [index, row] of rows.entries()) {
    const failure = await importRow(importExecution, row, index + 2);
    if (failure) failures.push(failure); else imported += 1;
  }
  return { imported, failures };
}

async function getDefaultCurrency(supabase: Supabase, workspaceId: string, entity: ImportEntity): Promise<string | null> {
  if (entity !== "leads") return "USD";
  const workspace = await supabase.from("workspaces").select("default_currency").eq("id", workspaceId).maybeSingle();
  return workspace.error || !workspace.data ? null : workspace.data.default_currency ?? "USD";
}

async function importRow(execution: ImportExecution, raw: Record<string, unknown>, rowNumber: number): Promise<RowFailure | null> {
  const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
  const parsed = validateImportRow(execution.entity, row);
  if (!parsed.success) return { row: rowNumber, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`) };
  const relationships = await resolveRelationships({ ...execution, row });
  if (relationships.message) return { row: rowNumber, errors: [relationships.message] };
  const ownerId = execution.canReassign ? relationships.ownerId ?? execution.context.userId : execution.context.userId;
  const values = insertValues({ ...execution, parsed: parsed.data as Record<string, unknown>, ownerId, relationships });
  const { error } = await execution.supabase.from(execution.entity).insert(values as never);
  return error ? { row: rowNumber, errors: ["The row could not be saved. Check values and workspace access."] } : null;
}

async function resolveRelationships(execution: ImportExecution & { row: Record<string, unknown> }) {
  const { supabase, context, entity, row, canReassign } = execution;
  const ownerId = canReassign && typeof row.ownerId === "string" ? row.ownerId || context.userId : context.userId;
  if (canReassign && ownerId !== context.userId) {
    const members = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: context.workspaceId, target_user_id: ownerId, target_lead_id: null });
    if (members.error || !members.data?.some((member: { user_id: string }) => member.user_id === ownerId)) return { message: "Owner ID must belong to an active member of this workspace." };
  }
  const sourceId = await findLeadSource(supabase, context.workspaceId, entity, row.source);
  if (sourceId.message) return { ownerId, sourceId: sourceId.id, companyId: null, message: sourceId.message };
  const companyId = await findCompany(supabase, context.workspaceId, entity, row.company);
  if (companyId.message) return { ownerId, sourceId: sourceId.id, companyId: companyId.id, message: companyId.message };
  return { ownerId, sourceId: sourceId.id, companyId: companyId.id, message: "" };
}

async function findLeadSource(supabase: Supabase, workspaceId: string, entity: ImportEntity, source: unknown) {
  if (entity !== "leads" || source === undefined || source === null || typeof source === "string" && !source.trim()) return { id: null as string | null, message: "" };
  if (typeof source !== "string") return { id: null as string | null, message: "Lead source must be text matching one active source in this workspace." };
  const result = await supabase.from("lead_sources").select("id").eq("workspace_id", workspaceId).eq("name", source.trim()).eq("is_active", true).limit(2);
  if (result.error || result.data?.length !== 1) return { id: null as string | null, message: "Lead source must match one active source in this workspace." };
  return { id: result.data[0].id, message: "" };
}

async function findCompany(supabase: Supabase, workspaceId: string, entity: ImportEntity, companyName: unknown) {
  if (entity !== "contacts" || companyName === undefined || companyName === null || typeof companyName === "string" && !companyName.trim()) return { id: null as string | null, message: "" };
  if (typeof companyName !== "string") return { id: null as string | null, message: "Company must be text matching one active company in this workspace." };
  const result = await supabase.from("companies").select("id").eq("workspace_id", workspaceId).eq("name", companyName.trim()).is("archived_at", null).limit(2);
  if (result.error || result.data?.length !== 1) return { id: null as string | null, message: "Company must match one active company in this workspace." };
  return { id: result.data[0].id, message: "" };
}

function insertValues(input: ImportExecution & { parsed: Record<string, unknown>; ownerId: string; relationships: { sourceId?: string | null; companyId?: string | null } }) {
  const base = { workspace_id: input.context.workspaceId, created_by: input.context.userId, owner_id: input.ownerId };
  if (input.entity === "leads") {
    const lead = input.parsed as { fullName: string; companyName: string | null; email: string | null; phone: string | null; jobTitle: string | null; status: string; estimatedValue: number; notesSummary: string | null };
    return { ...base, full_name: lead.fullName, company_name: lead.companyName, email: lead.email, phone: lead.phone, job_title: lead.jobTitle, status: lead.status || "new", estimated_value: lead.estimatedValue, notes_summary: lead.notesSummary, source_id: input.relationships.sourceId, currency: input.currency };
  }
  if (input.entity === "contacts") {
    const contact = input.parsed as { firstName: string; lastName: string; email: string | null; phone: string | null; jobTitle: string | null; lifecycleStatus: string; linkedinUrl: string | null };
    return { ...base, first_name: contact.firstName, last_name: contact.lastName, email: contact.email, phone: contact.phone, job_title: contact.jobTitle, lifecycle_status: contact.lifecycleStatus || "active", linkedin_url: contact.linkedinUrl, company_id: input.relationships.companyId };
  }
  const company = input.parsed as { name: string; website: string | null; industry: string | null; employeeSize: number | null; phone: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null; description: string | null };
  return { ...base, name: company.name, website: company.website, industry: company.industry, employee_size: company.employeeSize, phone: company.phone, address_line_1: company.addressLine1, address_line_2: company.addressLine2, city: company.city, state: company.state, postal_code: company.postalCode, country: company.country, description: company.description };
}

async function saveImportHistory(execution: Pick<ImportExecution, "supabase" | "context" | "entity">, summary: ImportSummary, totalRows: number): Promise<boolean> {
  const { error } = await execution.supabase.from("crm_import_jobs").insert({
    workspace_id: execution.context.workspaceId, created_by: execution.context.userId, entity: execution.entity,
    status: summary.failures.length ? (summary.imported ? "completed_with_errors" : "failed") : "completed",
    total_rows: totalRows, imported_rows: summary.imported, rejected_rows: summary.failures.length, row_errors: summary.failures,
  });
  return !error;
}

function failure(message: string): ImportResult {
  return { ok: false, message, imported: 0, rejected: 0, errors: [] };
}
