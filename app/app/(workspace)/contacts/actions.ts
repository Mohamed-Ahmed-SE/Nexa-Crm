"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { canRetainArchivedCompany, contactCanBeEdited } from "@/lib/contacts/relations";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";
import { contactIdSchema, contactInputSchema } from "@/lib/contacts/schema";
import { getContactForEdit } from "@/lib/contacts/repository";
import { findContactDuplicates, normalizeContactEmail, normalizeContactPhone, type ContactDuplicate, type ContactDuplicateCandidate } from "@/lib/contacts/duplicates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactActivityInputSchema, contactNoteInputSchema, contactTaskInputSchema } from "@/lib/contacts/engagement-schema";

export type ContactActionState = { ok?: boolean; refreshRequired?: boolean; message?: string; fieldErrors?: Record<string, string[]>; duplicateMatches?: ContactDuplicate[] };
const text = (form: FormData, key: string) => { const formEntry = form.get(key); return typeof formEntry === "string" ? formEntry : ""; };
function parseContact(form: FormData) {
  return contactInputSchema.safeParse({
    firstName: text(form, "firstName"), lastName: text(form, "lastName"), email: text(form, "email"), phone: text(form, "phone"),
    jobTitle: text(form, "jobTitle"), companyId: text(form, "companyId"), ownerId: text(form, "ownerId"),
    lifecycleStatus: text(form, "lifecycleStatus"), linkedinUrl: text(form, "linkedinUrl"),
  });
}

async function verifyCompany(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, companyId: string | null, currentCompanyId: string | null = null) {
  if (!companyId) return true;
  let query = supabase.from("companies").select("id").eq("workspace_id", workspaceId).eq("id", companyId);
  if (!canRetainArchivedCompany(companyId, currentCompanyId)) query = query.is("archived_at", null);
  const { data: matchingCompany, error } = await query.maybeSingle();
  return !error && Boolean(matchingCompany);
}

async function verifyOwner(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, ownerId: string | null) {
  if (!ownerId) return true;
  const { data: reassignableMembers, error } = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: ownerId, target_lead_id: null });
  return !error && Boolean(reassignableMembers?.some((member: { user_id: string }) => member.user_id === ownerId));
}

async function editableContact(contactId: string) {
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { context, supabase: null, contact: null, error: "Authentication is not configured." };
  const { data: contact, error } = await getContactForEdit(supabase, context.workspaceId, contactId);
  if (error || !contact) return { context, supabase, contact: null, error: "Contact not found in this workspace." };
  if (!contactCanBeEdited(hasWorkspacePermission(context.role, "crm.edit.all"), contact.owner_id, context.userId)) {
    return { context, supabase, contact: null, error: "You can update only contacts assigned to you." };
  }
  return { context, supabase, contact, error: null };
}

export async function createContactAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const context = await requirePermission("crm.create");
  const parsed = parseContact(form);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const ownerId = canReassign ? parsed.data.ownerId : context.userId;
  if (!await verifyCompany(supabase, context.workspaceId, parsed.data.companyId)) return { message: "Select an active company in this workspace." };
  if (canReassign && !await verifyOwner(supabase, context.workspaceId, ownerId)) return { message: "Select an active owner in this workspace." };
  const email = normalizeContactEmail(parsed.data.email);
  const phone = normalizeContactPhone(parsed.data.phone);
  let duplicateMatches: ContactDuplicate[] = [];
  if (email || phone) {
    const { data: candidates, error: duplicateLookupError } = await supabase.from("contacts")
      .select("first_name,last_name,email,phone,companies(name)")
      .eq("workspace_id", context.workspaceId)
      .is("archived_at", null);
    if (!duplicateLookupError) duplicateMatches = findContactDuplicates((candidates ?? []) as ContactDuplicateCandidate[], email, phone);
  }
  if (duplicateMatches.length && text(form, "confirmDuplicate") !== "true") return { duplicateMatches };
  const { error } = await supabase.from("contacts").insert({
    workspace_id: context.workspaceId,
    created_by: context.userId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    job_title: parsed.data.jobTitle,
    company_id: parsed.data.companyId,
    owner_id: ownerId,
    lifecycle_status: parsed.data.lifecycleStatus,
    linkedin_url: parsed.data.linkedinUrl,
  });
  if (error) return { message: "Contact could not be created. Check your access and try again." };
  revalidatePath("/app/contacts");
  return { ok: true, message: "Contact added." };
}

export async function updateContactAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const context = await requirePermission("crm.edit.own");
  const id = contactIdSchema.safeParse(text(form, "id"));
  if (!id.success) return { message: "This contact could not be identified." };
  const parsed = parseContact(form);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: current, error } = await getContactForEdit(supabase, context.workspaceId, id.data);
  if (error || !current) return { message: "Contact not found in this workspace." };
  if (!contactCanBeEdited(hasWorkspacePermission(context.role, "crm.edit.all"), current.owner_id, context.userId)) return { message: "You can update only contacts assigned to you." };
  if (!await verifyCompany(supabase, context.workspaceId, parsed.data.companyId, current.company_id)) return { message: "Select an active company in this workspace." };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (parsed.data.ownerId !== current.owner_id && !canReassign) return { message: "You do not have permission to reassign this contact." };
  if (canReassign && parsed.data.ownerId !== current.owner_id && !await verifyOwner(supabase, context.workspaceId, parsed.data.ownerId)) return { message: "Select an active owner in this workspace." };
  const { data, error: updateError } = await supabase.from("contacts").update({ ...parsed.data, owner_id: canReassign ? parsed.data.ownerId : current.owner_id }).eq("workspace_id", context.workspaceId).eq("id", id.data).is("archived_at", null).select("id").maybeSingle();
  if (updateError || !data) return { message: "Contact could not be updated. Check your access and try again." };
  revalidatePath("/app/contacts"); revalidatePath(`/app/contacts/${id.data}`);
  return { ok: true, message: "Contact updated." };
}

export async function logContactActivityAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const id = contactIdSchema.safeParse(text(form, "contactId"));
  if (!id.success) return { message: "This contact could not be identified." };
  const { context, supabase, contact, error } = await editableContact(id.data);
  if (error || !supabase || !contact) return { message: error ?? "Contact not found." };
  const parsed = contactActivityInputSchema.safeParse({ type: text(form, "type"), subject: text(form, "subject"), body: text(form, "body"), occurredAt: normalizeContactDateTime(text(form, "occurredAt"), text(form, "timezoneOffset")) });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error: insertError } = await supabase.from("activities").insert({ workspace_id: context.workspaceId, activity_type: parsed.data.type, subject: parsed.data.subject, body: parsed.data.body, occurred_at: parsed.data.occurredAt, created_by: context.userId, owner_id: context.userId, related_entity_type: "contact", related_entity_id: id.data, metadata: {}, is_system_event: false });
  if (insertError) return { message: "Activity could not be saved." };
  revalidatePath(`/app/contacts/${id.data}`);
  return { ok: true, message: "Activity logged." };
}

export async function addContactNoteAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const id = contactIdSchema.safeParse(text(form, "contactId"));
  if (!id.success) return { message: "This contact could not be identified." };
  const { context, supabase, contact, error } = await editableContact(id.data);
  if (error || !supabase || !contact) return { message: error ?? "Contact not found." };
  const parsed = contactNoteInputSchema.safeParse({ body: text(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error: insertError } = await supabase.from("notes").insert({ workspace_id: context.workspaceId, body: parsed.data.body, is_pinned: false, created_by: context.userId, related_entity_type: "contact", related_entity_id: id.data });
  if (insertError) return { message: "Note could not be saved." };
  revalidatePath(`/app/contacts/${id.data}`);
  return { ok: true, message: "Note added." };
}

export async function createContactTaskAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const id = contactIdSchema.safeParse(text(form, "contactId"));
  if (!id.success) return { message: "This contact could not be identified." };
  const { context, supabase, contact, error } = await editableContact(id.data);
  if (error || !supabase || !contact) return { message: error ?? "Contact not found." };
  const parsed = contactTaskInputSchema.safeParse({ title: text(form, "title"), description: text(form, "description"), type: text(form, "type"), priority: text(form, "priority"), dueAt: normalizeContactDateTime(text(form, "dueAt"), text(form, "timezoneOffset")), assignedTo: text(form, "assignedTo") });
  if (!parsed.success) return { message: "Check the task details.", fieldErrors: parsed.error.flatten().fieldErrors };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const assignedTo = canReassign ? parsed.data.assignedTo : context.userId;
  if (assignedTo && !await verifyOwner(supabase, context.workspaceId, assignedTo)) return { message: "Select an active assignee in this workspace." };
  const { error: insertError } = await supabase.from("tasks").insert({ workspace_id: context.workspaceId, title: parsed.data.title, description: parsed.data.description, task_type: parsed.data.type, status: "open", priority: parsed.data.priority, due_at: parsed.data.dueAt, assigned_to: assignedTo, created_by: context.userId, related_entity_type: "contact", related_entity_id: id.data });
  if (insertError) return { message: "Task could not be created." };
  revalidatePath(`/app/contacts/${id.data}`); revalidatePath("/app/tasks");
  return { ok: true, message: "Task created." };
}

const maxAttachmentBytes = 10 * 1024 * 1024;
const allowedFiles = new Map([
  ["application/pdf", ["pdf"]],
  ["text/plain", ["txt"]],
  ["text/csv", ["csv"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx"]],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ["pptx"]],
]);

function safeFilename(originalFilename: string) {
  const normalized = originalFilename.normalize("NFKC").replace(/[\/\\\u0000-\u001f\u007f]/g, "_").replace(/[^a-zA-Z0-9 ._()-]/g, "_").trim().replace(/^\.+/, "");
  const segments = normalized.split(".");
  const extension = segments.length > 1 ? `.${segments.pop()}` : "";
  const basename = segments.join(".").slice(0, 240 - extension.length).trim() || "attachment";
  return `${basename}${extension}`;
}

function validFileHeader(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mimeType === "text/plain" || mimeType === "text/csv") return !bytes.slice(0, 8192).some((byte) => byte === 0);
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function uploadContactFileAction(_previous: ContactActionState, form: FormData): Promise<ContactActionState> {
  const id = contactIdSchema.safeParse(text(form, "contactId"));
  const file = form.get("file");
  if (!id.success || !(file instanceof File) || file.size < 1) return { message: "Choose a file to upload." };
  if (file.size > maxAttachmentBytes) return { message: "Files must be 10 MB or smaller." };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedFiles.has(file.type) || !allowedFiles.get(file.type)?.includes(extension)) return { message: "Use a PDF, text, CSV, DOCX, XLSX, or PPTX file." };
  const { context, supabase, contact, error } = await editableContact(id.data);
  if (error || !supabase || !contact) return { message: error ?? "Contact not found." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validFileHeader(bytes, file.type)) return { message: "The file content does not match its declared type." };
  const filename = safeFilename(file.name);
  const storagePath = `${context.workspaceId}/${id.data}/${crypto.randomUUID()}-${filename}`;
  const { data: attachment, error: rowError } = await supabase.from("attachments").insert({ workspace_id: context.workspaceId, storage_path: storagePath, filename, mime_type: file.type, size_bytes: file.size, uploaded_by: context.userId, related_entity_type: "contact", related_entity_id: id.data }).select("id").maybeSingle();
  if (rowError || !attachment) return { message: "File metadata could not be saved." };
  const { error: uploadError } = await supabase.storage.from("contact-attachments").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.from("attachments").delete().eq("workspace_id", context.workspaceId).eq("id", attachment.id);
    return { message: "File upload failed. Try again." };
  }
  revalidatePath(`/app/contacts/${id.data}`);
  return { ok: true, message: "File uploaded." };
}

type TaskCompletionActivity = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  contactId: string;
  completedAt: string;
};

async function logContactTaskCompletion({ supabase, workspaceId, userId, taskId, taskTitle, contactId, completedAt }: TaskCompletionActivity) {
  const { error } = await supabase.from("activities").insert({
    workspace_id: workspaceId, activity_type: "task_completed", subject: "Task completed", body: taskTitle,
    occurred_at: completedAt, created_by: userId, owner_id: userId, related_entity_type: "contact",
    related_entity_id: contactId, metadata: { task_id: taskId }, is_system_event: false,
  });
  return error;
}

type ContactTaskCompletion = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  task: { id: string; title: string; related_entity_id: string };
};

async function completeTaskAndLogActivity({ supabase, workspaceId, userId, task }: ContactTaskCompletion): Promise<ContactActionState> {
  const completedAt = new Date().toISOString();
  const { data: completedTask, error: updateError } = await supabase.from("tasks").update({ status: "completed", completed_at: completedAt }).eq("workspace_id", workspaceId).eq("id", task.id).eq("status", "open").select("id").maybeSingle();
  if (updateError || !completedTask) return { message: "Task could not be completed." };
  const activityError = await logContactTaskCompletion({ supabase, workspaceId, userId, taskId: task.id, taskTitle: task.title, contactId: task.related_entity_id, completedAt });
  revalidatePath(`/app/contacts/${task.related_entity_id}`);
  revalidatePath("/app/tasks");
  if (activityError) return { refreshRequired: true, message: "Task was completed, but its activity could not be recorded." };
  return { ok: true, message: "Task completed." };
}

export async function completeContactTaskAction(taskId: string): Promise<ContactActionState> {
  const parsedId = contactIdSchema.safeParse(taskId);
  if (!parsedId.success) return { message: "This task could not be identified." };
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: task, error } = await supabase.from("tasks").select("id, title, related_entity_id, related_entity_type, assigned_to, status").eq("workspace_id", context.workspaceId).eq("id", parsedId.data).maybeSingle();
  if (error || !task || task.related_entity_type !== "contact" || !task.related_entity_id) return { message: "Task not found for this workspace contact." };
  const { data: contact, error: contactError } = await getContactForEdit(supabase, context.workspaceId, task.related_entity_id);
  if (contactError || !contact || !contactCanBeEdited(hasWorkspacePermission(context.role, "crm.edit.all"), contact.owner_id, context.userId)) return { message: "You can complete tasks only for contacts assigned to you." };
  if (task.status !== "open") return { message: "This task is no longer open." };
  return completeTaskAndLogActivity({ supabase, workspaceId: context.workspaceId, userId: context.userId, task });
}
