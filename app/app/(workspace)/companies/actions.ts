"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { companyActivityInputSchema, companyIdSchema, companyInputSchema, companyNoteSchema, companyTaskSchema, type CompanyInput } from "@/lib/companies/schema";
import { getCompany } from "@/lib/companies/repository";
import { findCompanyDuplicates, type CompanyDuplicateCandidate } from "@/lib/companies/duplicates";
import { isValidCompanyUploadContent, validateCompanyUploadMetadata } from "@/lib/companies/upload";
import { deleteWorkspaceAttachment } from "@/lib/attachments/delete";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activityModificationError, deleteManualActivity, updateManualActivity, type ActivityTarget, type ActivityVerb } from "@/lib/activities/modify";
import { replaceEntityTags, verifyWorkspaceTagIds } from "@/lib/tags/entity-tags";

export type CompanyActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]>; duplicateMatches?: CompanyDuplicateCandidate[]; tagWarning?: boolean };
const value = (form: FormData, key: string) => { const item = form.get(key); return typeof item === "string" ? item : ""; };
const parseInput = (form: FormData) => companyInputSchema.safeParse({
  ...Object.fromEntries(["name", "website", "industry", "employeeSize", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "description", "ownerId"].map((key) => [key, value(form, key)])),
  tagIds: form.getAll("tagIds"),
});
const companyFields = (input: CompanyInput, ownerId = input.ownerId) => ({
  name: input.name, website: input.website, industry: input.industry, employee_size: input.employeeSize,
  phone: input.phone, address_line_1: input.addressLine1, address_line_2: input.addressLine2,
  city: input.city, state: input.state, postal_code: input.postalCode, country: input.country,
  description: input.description, owner_id: ownerId,
});

async function companyAccess(companyId: string) {
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { context, supabase: null, company: null, message: "Authentication is not configured." };
  const { data: company, error } = await getCompany(supabase, context.workspaceId, companyId);
  if (error || !company) return { context, supabase, company: null, message: "Company not found in this workspace." };
  const canEdit = hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && company.owner_id === context.userId);
  if (!canEdit) return { context, supabase, company: null, message: "You can update only companies assigned to you." };
  return { context, supabase, company, message: null };
}

async function verifyOwner(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, ownerId: string | null) {
  if (!ownerId) return true;
  const { data, error } = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: ownerId, target_lead_id: null });
  return !error && Boolean(data?.some((member: { user_id: string }) => member.user_id === ownerId));
}

export async function createCompanyAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const context = await requirePermission("crm.create");
  const parsed = parseInput(form);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  if (!await verifyWorkspaceTagIds(supabase, context.workspaceId, parsed.data.tagIds)) return { message: "Choose tags from this workspace." };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const ownerId = canReassign ? parsed.data.ownerId : context.userId;
  if (parsed.data.ownerId && !canReassign) return { message: "You cannot assign this company to another member." };
  if (!await verifyOwner(supabase, context.workspaceId, ownerId)) return { message: "Choose a member of this workspace." };
  const { data: candidates, error: duplicateLookupError } = await supabase.from("companies").select("id,name,website")
    .eq("workspace_id", context.workspaceId).is("archived_at", null);
  if (duplicateLookupError) return { message: "Unable to check for duplicate companies." };
  const duplicateMatches = findCompanyDuplicates((candidates ?? []) as CompanyDuplicateCandidate[], parsed.data.name, parsed.data.website);
  if (duplicateMatches.length && value(form, "confirmDuplicate") !== "true") return { duplicateMatches };
  const { data: createdCompany, error } = await supabase.from("companies").insert({
    workspace_id: context.workspaceId, created_by: context.userId, ...companyFields(parsed.data, ownerId),
  }).select("id").maybeSingle();
  if (error || !createdCompany?.id) return { message: "Unable to create this company." };
  const tagsSaved = !parsed.data.tagIds.length || await replaceEntityTags(supabase, context.workspaceId, "company", createdCompany.id, parsed.data.tagIds);
  revalidatePath("/app/companies");
  const logged = await logCompanyCreation(supabase, context.workspaceId, context.userId, createdCompany.id);
  if (!tagsSaved) return { ok: true, message: "Company added, but its tags could not be saved. Edit the company to try again.", tagWarning: true };
  return logged
    ? { ok: true }
    : { ok: true, message: "Company added, but its activity could not be recorded." };
}

async function logCompanyCreation(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  workspaceId: string,
  userId: string,
  companyId: string,
) {
  try {
    const { error } = await supabase.from("activities").insert({
      workspace_id: workspaceId, activity_type: "record_created", subject: "Company created",
      occurred_at: new Date().toISOString(), created_by: userId, owner_id: userId,
      related_entity_type: "company", related_entity_id: companyId, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function updateCompanyAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = companyIdSchema.safeParse(value(form, "id"));
  if (!id.success) return { message: "Company not found." };
  const parsed = parseInput(form);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  const access = await companyAccess(id.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to update company." };
  const { context, supabase, company } = access;
  if (!await verifyWorkspaceTagIds(supabase, context.workspaceId, parsed.data.tagIds)) return { message: "Choose tags from this workspace." };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (!canReassign && parsed.data.ownerId !== company.owner_id) return { message: "You cannot change company ownership." };
  if (parsed.data.ownerId !== company.owner_id && !await verifyOwner(supabase, context.workspaceId, parsed.data.ownerId)) return { message: "Choose a member of this workspace." };
  const { error } = await supabase.from("companies").update(companyFields(parsed.data)).eq("workspace_id", context.workspaceId).eq("id", id.data);
  if (error) return { message: "Unable to update this company." };
  const tagsSaved = await replaceEntityTags(supabase, context.workspaceId, "company", id.data, parsed.data.tagIds);
  revalidatePath("/app/companies");
  revalidatePath(`/app/companies/${id.data}`);
  if (company.owner_id !== parsed.data.ownerId) {
    const logged = await logCompanyOwnerChange({
      supabase, workspaceId: context.workspaceId, userId: context.userId, companyId: id.data,
      oldOwnerId: company.owner_id, newOwnerId: parsed.data.ownerId,
    });
    if (!logged) return { ok: true, message: "Company updated, but its owner-change activity could not be recorded." };
  }
  if (!tagsSaved) return { ok: true, message: "Company details were updated, but tags could not be saved. Existing tags were retained where possible.", tagWarning: true };
  return { ok: true };
}

async function getCompanyOwnerLabel(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, ownerId: string | null) {
  if (!ownerId) return "Unassigned";
  try {
    const { data: profile, error } = await supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
    const label = !error ? profile?.full_name?.trim() : "";
    return label && label !== ownerId && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(label) ? label : "Workspace member";
  } catch {
    return "Workspace member";
  }
}

async function logCompanyOwnerChange({ supabase, workspaceId, userId, companyId, oldOwnerId, newOwnerId }: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  companyId: string;
  oldOwnerId: string | null;
  newOwnerId: string | null;
}) {
  const [oldOwner, newOwner] = await Promise.all([
    getCompanyOwnerLabel(supabase, oldOwnerId), getCompanyOwnerLabel(supabase, newOwnerId),
  ]);
  try {
    const { error } = await supabase.from("activities").insert({
      workspace_id: workspaceId, activity_type: "owner_changed", subject: "Company owner changed",
      body: `Company owner changed from ${oldOwner} to ${newOwner}.`, occurred_at: new Date().toISOString(),
      created_by: userId, owner_id: userId, related_entity_type: "company", related_entity_id: companyId,
      metadata: { old_owner_id: oldOwnerId, new_owner_id: newOwnerId }, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function archiveCompanyAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const context = await requirePermission("crm.archive");
  const parsedId = companyIdSchema.safeParse(value(form, "id"));
  if (!parsedId.success) return { message: "Company not found." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { error } = await supabase.from("companies").update({ archived_at: new Date().toISOString() }).eq("workspace_id", context.workspaceId).eq("id", parsedId.data).is("archived_at", null);
  if (error) return { message: "Unable to archive this company." };
  revalidatePath("/app/companies");
  return { ok: true };
}

export async function logCompanyActivityAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = companyIdSchema.safeParse(value(form, "companyId"));
  const parsed = companyActivityInputSchema.safeParse({ type: value(form, "type"), subject: value(form, "subject"), body: value(form, "body"), occurredAt: normalizeContactDateTime(value(form, "occurredAt"), value(form, "timezoneOffset")) });
  if (!id.success || !parsed.success) return { message: "Enter valid activity details." };
  const access = await companyAccess(id.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to record activity." };
  const { context, supabase } = access;
  const { error } = await supabase.from("activities").insert({ workspace_id: context.workspaceId, created_by: context.userId, owner_id: context.userId, related_entity_type: "company", related_entity_id: id.data, activity_type: parsed.data.type, subject: parsed.data.subject, body: parsed.data.body, occurred_at: parsed.data.occurredAt, is_system_event: false });
  if (error) return { message: "Unable to record this activity." };
  revalidatePath(`/app/companies/${id.data}`);
  return { ok: true };
}

async function modifiableCompanyActivity(form: FormData, verb: ActivityVerb) {
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  const activityId = companyIdSchema.safeParse(value(form, "activityId"));
  if (!companyId.success || !activityId.success) return { supabase: null, message: "This activity could not be identified." };
  const access = await companyAccess(companyId.data);
  if (!access.supabase || !access.company) return { supabase: null, message: access.message ?? "Company not found." };
  const { context, supabase } = access;
  const target: ActivityTarget = { workspaceId: context.workspaceId, entityType: "company", entityId: companyId.data, activityId: activityId.data };
  const message = await activityModificationError(supabase, { target, role: context.role, userId: context.userId, verb, entityLabel: "company" });
  return message ? { supabase: null, message } : { supabase, target };
}

export async function updateCompanyActivityAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const access = await modifiableCompanyActivity(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = companyActivityInputSchema.safeParse({ type: value(form, "type"), subject: value(form, "subject"), body: value(form, "body"), occurredAt: normalizeContactDateTime(value(form, "occurredAt"), value(form, "timezoneOffset")) });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!await updateManualActivity(access.supabase, access.target, parsed.data)) return { message: "Activity could not be updated. Refresh the company and try again." };
  revalidatePath(`/app/companies/${access.target.entityId}`);
  return { ok: true, message: "Activity updated." };
}

export async function deleteCompanyActivityAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const access = await modifiableCompanyActivity(form, "delete");
  if (!access.supabase) return { message: access.message };
  if (!await deleteManualActivity(access.supabase, access.target)) return { message: "Activity could not be deleted. Refresh the company and try again." };
  revalidatePath(`/app/companies/${access.target.entityId}`);
  return { ok: true, message: "Activity deleted." };
}

export async function addCompanyNoteAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = companyIdSchema.safeParse(value(form, "companyId"));
  const parsed = companyNoteSchema.safeParse({ body: value(form, "body") });
  if (!id.success || !parsed.success) return { message: "Enter a note." };
  const access = await companyAccess(id.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to add note." };
  const { context, supabase } = access;
  const { error } = await supabase.from("notes").insert({ workspace_id: context.workspaceId, created_by: context.userId, related_entity_type: "company", related_entity_id: id.data, body: parsed.data.body });
  if (error) return { message: "Unable to add this note." };
  revalidatePath(`/app/companies/${id.data}`);
  return { ok: true };
}

export async function toggleCompanyNotePinnedAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  const noteId = companyIdSchema.safeParse(value(form, "noteId"));
  if (!companyId.success || !noteId.success) return { message: "This note could not be identified." };
  const access = await companyAccess(companyId.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Company not found." };
  const { context, supabase } = access;
  const { data: note, error: lookupError } = await supabase.from("notes").select("id, is_pinned, created_by")
    .eq("workspace_id", context.workspaceId).eq("related_entity_type", "company")
    .eq("related_entity_id", companyId.data).eq("id", noteId.data).maybeSingle();
  if (lookupError || !note) return { message: "Note could not be updated. Refresh the company and try again." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && note.created_by !== context.userId) {
    return { message: "You can update only your own notes." };
  }
  const { data: updatedNote, error: updateError } = await supabase.from("notes").update({ is_pinned: !note.is_pinned })
    .eq("workspace_id", context.workspaceId).eq("related_entity_type", "company")
    .eq("related_entity_id", companyId.data).eq("id", noteId.data).select("id").maybeSingle();
  if (updateError || !updatedNote) return { message: "Note could not be updated. Refresh the company and try again." };
  revalidatePath(`/app/companies/${companyId.data}`);
  return { ok: true, message: `Note ${note.is_pinned ? "unpinned" : "pinned"}.` };
}

async function modifiableCompanyNote(form: FormData, verb: "update" | "delete") {
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  const noteId = companyIdSchema.safeParse(value(form, "noteId"));
  if (!companyId.success || !noteId.success) return { supabase: null, message: "This note could not be identified." };
  const access = await companyAccess(companyId.data);
  if (!access.supabase || !access.company) return { supabase: null, message: access.message ?? "Company not found." };
  const { context, supabase } = access;
  const { data: note, error: lookupError } = await supabase.from("notes").select("id, created_by")
    .eq("workspace_id", context.workspaceId).eq("related_entity_type", "company")
    .eq("related_entity_id", companyId.data).eq("id", noteId.data).maybeSingle();
  if (lookupError || !note) return { supabase: null, message: `Note could not be ${verb}d. Refresh the company and try again.` };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && note.created_by !== context.userId) {
    return { supabase: null, message: `You can ${verb} only your own notes.` };
  }
  return { context, supabase, companyId: companyId.data, noteId: noteId.data };
}

export async function updateCompanyNoteAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const access = await modifiableCompanyNote(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = companyNoteSchema.safeParse({ body: value(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { data: updatedNote, error: updateError } = await access.supabase.from("notes").update({ body: parsed.data.body })
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "company")
    .eq("related_entity_id", access.companyId).eq("id", access.noteId).select("id").maybeSingle();
  if (updateError || !updatedNote) return { message: "Note could not be updated. Refresh the company and try again." };
  revalidatePath(`/app/companies/${access.companyId}`);
  return { ok: true, message: "Note updated." };
}

export async function deleteCompanyNoteAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const access = await modifiableCompanyNote(form, "delete");
  if (!access.supabase) return { message: access.message };
  const { data: deletedNote, error: deleteError } = await access.supabase.from("notes").delete()
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "company")
    .eq("related_entity_id", access.companyId).eq("id", access.noteId).select("id").maybeSingle();
  if (deleteError || !deletedNote) return { message: "Note could not be deleted. Refresh the company and try again." };
  revalidatePath(`/app/companies/${access.companyId}`);
  return { ok: true, message: "Note deleted." };
}

export async function createCompanyTaskAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = companyIdSchema.safeParse(value(form, "companyId"));
  const parsed = companyTaskSchema.safeParse({ title: value(form, "title"), description: value(form, "description"), type: value(form, "type"), priority: value(form, "priority"), dueAt: normalizeContactDateTime(value(form, "dueAt"), value(form, "timezoneOffset")), assignedTo: value(form, "assignedTo") });
  if (!id.success || !parsed.success) return { message: "Enter valid task details." };
  const access = await companyAccess(id.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to create task." };
  const { context, supabase, company } = access;
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (parsed.data.assignedTo && parsed.data.assignedTo !== context.userId && !canReassign) return { message: "You cannot assign this task to another member." };
  const assignedTo = canReassign ? parsed.data.assignedTo : context.userId;
  if (!await verifyOwner(supabase, context.workspaceId, assignedTo)) return { message: "Choose a member of this workspace." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && company.owner_id !== context.userId) return { message: "Tasks can be created only for companies assigned to you." };
  const { error } = await supabase.from("tasks").insert({ workspace_id: context.workspaceId, created_by: context.userId, assigned_to: assignedTo, related_entity_type: "company", related_entity_id: id.data, title: parsed.data.title, description: parsed.data.description, task_type: parsed.data.type, priority: parsed.data.priority, due_at: parsed.data.dueAt, status: "open" });
  if (error) return { message: "Unable to create this task." };
  revalidatePath(`/app/companies/${id.data}`);
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function completeCompanyTaskAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const context = await requirePermission("crm.edit.own");
  const taskId = companyIdSchema.safeParse(value(form, "taskId"));
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  if (!taskId.success || !companyId.success) return { message: "Task not found." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: company } = await getCompany(supabase, context.workspaceId, companyId.data);
  const { data: task, error } = await supabase.from("tasks").select("id, title, status, assigned_to, related_entity_type, related_entity_id").eq("workspace_id", context.workspaceId).eq("id", taskId.data).eq("related_entity_type", "company").eq("related_entity_id", companyId.data).maybeSingle();
  if (error || !company || !task || task.status !== "open") return { message: "Open task not found for this company." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && task.assigned_to !== context.userId && company.owner_id !== context.userId) return { message: "You cannot complete this task." };
  const completedAt = new Date().toISOString();
  const { data: completedTask, error: updateError } = await supabase.from("tasks").update({ status: "completed", completed_at: completedAt }).eq("workspace_id", context.workspaceId).eq("id", taskId.data).eq("status", "open").select("id").maybeSingle();
  if (updateError || !completedTask) return { message: "Unable to complete this task." };
  revalidatePath(`/app/companies/${companyId.data}`);
  revalidatePath("/app/tasks");
  const { error: activityError } = await supabase.from("activities").insert({
    workspace_id: context.workspaceId, activity_type: "task_completed", subject: "Task completed", body: task.title,
    occurred_at: completedAt, created_by: context.userId, owner_id: context.userId,
    related_entity_type: "company", related_entity_id: companyId.data,
    metadata: { task_id: task.id }, is_system_event: false,
  });
  if (activityError) return { ok: true, message: "Task completed, but its activity could not be recorded." };
  return { ok: true };
}

function parseCompanyUpload(form: FormData) {
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  const file = form.get("file");
  if (!companyId.success || !(file instanceof File)) return { message: "Choose a file to upload." };
  const metadata = validateCompanyUploadMetadata(file);
  if ("message" in metadata) return metadata;
  return { companyId: companyId.data, file, ...metadata };
}

export async function uploadCompanyFileAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const parsedFile = parseCompanyUpload(form);
  if ("message" in parsedFile) return { message: parsedFile.message };
  const { companyId, file, filename, mimeType } = parsedFile;
  const access = await companyAccess(companyId);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to upload file." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidCompanyUploadContent(bytes, mimeType, file.size)) return { message: "The file content does not match its declared type." };
  const { context, supabase } = access;
  const fileId = crypto.randomUUID();
  const storagePath = `${context.workspaceId}/${companyId}/${fileId}/${filename}`;
  const { error: recordError } = await supabase.from("attachments").insert({ id: fileId, workspace_id: context.workspaceId, storage_path: storagePath, filename, mime_type: mimeType, size_bytes: file.size, uploaded_by: context.userId, related_entity_type: "company", related_entity_id: companyId });
  if (recordError) return { message: "Unable to save file details." };
  const { error: uploadError } = await supabase.storage.from("company-attachments").upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) {
    const { error: cleanupError } = await supabase.from("attachments").delete().eq("workspace_id", context.workspaceId).eq("id", fileId);
    if (cleanupError) return { message: "Upload failed and file details could not be cleaned up. Contact support." };
    return { message: "Unable to upload this file." };
  }
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true };
}

export async function deleteCompanyFileAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const companyId = companyIdSchema.safeParse(value(form, "companyId"));
  const fileId = companyIdSchema.safeParse(value(form, "fileId"));
  if (!companyId.success || !fileId.success) return { message: "This file could not be identified." };
  const access = await companyAccess(companyId.data);
  if (!access.supabase || !access.company) return { message: access.message ?? "Unable to delete file." };
  const { context, supabase } = access;
  const result = await deleteWorkspaceAttachment(supabase, "company-attachments", { workspaceId: context.workspaceId, entityType: "company", entityId: companyId.data, attachmentId: fileId.data });
  if (!result.ok) return { message: result.message };
  revalidatePath(`/app/companies/${companyId.data}`);
  return { ok: true, message: "File deleted." };
}
