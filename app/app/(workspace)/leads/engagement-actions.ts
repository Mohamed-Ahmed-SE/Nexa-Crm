"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";
import { leadActivityInputSchema, leadNoteInputSchema } from "@/lib/leads/engagement-schema";
import { leadIdSchema } from "@/lib/leads/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activityModificationError, deleteManualActivity, updateManualActivity, type ActivityTarget, type ActivityVerb } from "@/lib/activities/modify";

export type LeadEngagementActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
const text = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
};

async function editableLead(leadId: string) {
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { context, supabase, error: "Authentication is not configured." };
  const { data: lead, error } = await supabase.from("leads").select("id, owner_id")
    .eq("workspace_id", context.workspaceId).eq("id", leadId).is("archived_at", null).maybeSingle();
  if (error || !lead) return { context, supabase, error: "Lead not found in this workspace." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && lead.owner_id !== context.userId) {
    return { context, supabase, error: "You can update only leads assigned to you." };
  }
  return { context, supabase, error: null };
}

export async function logLeadActivityAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const parsedId = leadIdSchema.safeParse(text(form, "leadId"));
  if (!parsedId.success) return { message: "This lead could not be identified." };
  const { context, supabase, error } = await editableLead(parsedId.data);
  if (error || !supabase) return { message: error ?? "Lead not found." };
  const occurredAt = normalizeContactDateTime(text(form, "occurredAt"), text(form, "timezoneOffset"));
  const parsed = leadActivityInputSchema.safeParse({
    type: text(form, "type"), subject: text(form, "subject"), body: text(form, "body"), occurredAt,
  });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error: insertError } = await supabase.from("activities").insert({
    workspace_id: context.workspaceId, activity_type: parsed.data.type, subject: parsed.data.subject,
    body: parsed.data.body, occurred_at: parsed.data.occurredAt, created_by: context.userId, owner_id: context.userId,
    related_entity_type: "lead", related_entity_id: parsedId.data, metadata: {}, is_system_event: false,
  });
  if (insertError) return { message: "Activity could not be saved." };
  revalidatePath(`/app/leads/${parsedId.data}`);
  return { ok: true, message: "Activity logged." };
}

async function modifiableLeadActivity(form: FormData, verb: ActivityVerb) {
  const parsedId = leadIdSchema.safeParse(text(form, "leadId"));
  const parsedActivityId = leadIdSchema.safeParse(text(form, "activityId"));
  if (!parsedId.success || !parsedActivityId.success) return { supabase: null, message: "This activity could not be identified." };
  const { context, supabase, error } = await editableLead(parsedId.data);
  if (error || !supabase) return { supabase: null, message: error ?? "Lead not found." };
  const target: ActivityTarget = { workspaceId: context.workspaceId, entityType: "lead", entityId: parsedId.data, activityId: parsedActivityId.data };
  const message = await activityModificationError(supabase, { target, role: context.role, userId: context.userId, verb, entityLabel: "lead" });
  return message ? { supabase: null, message } : { supabase, target };
}

export async function updateLeadActivityAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const access = await modifiableLeadActivity(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = leadActivityInputSchema.safeParse({
    type: text(form, "type"), subject: text(form, "subject"), body: text(form, "body"),
    occurredAt: normalizeContactDateTime(text(form, "occurredAt"), text(form, "timezoneOffset")),
  });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!await updateManualActivity(access.supabase, access.target, parsed.data)) return { message: "Activity could not be updated. Refresh the lead and try again." };
  revalidatePath(`/app/leads/${access.target.entityId}`);
  return { ok: true, message: "Activity updated." };
}

export async function deleteLeadActivityAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const access = await modifiableLeadActivity(form, "delete");
  if (!access.supabase) return { message: access.message };
  if (!await deleteManualActivity(access.supabase, access.target)) return { message: "Activity could not be deleted. Refresh the lead and try again." };
  revalidatePath(`/app/leads/${access.target.entityId}`);
  return { ok: true, message: "Activity deleted." };
}

export async function addLeadNoteAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const parsedId = leadIdSchema.safeParse(text(form, "leadId"));
  if (!parsedId.success) return { message: "This lead could not be identified." };
  const { context, supabase, error } = await editableLead(parsedId.data);
  if (error || !supabase) return { message: error ?? "Lead not found." };
  const parsed = leadNoteInputSchema.safeParse({ body: text(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error: insertError } = await supabase.from("notes").insert({
    workspace_id: context.workspaceId, body: parsed.data.body, is_pinned: false,
    created_by: context.userId, related_entity_type: "lead", related_entity_id: parsedId.data,
  });
  if (insertError) return { message: "Note could not be saved." };
  revalidatePath(`/app/leads/${parsedId.data}`);
  return { ok: true, message: "Note added." };
}

async function modifiableLeadNote(form: FormData, verb: "update" | "delete") {
  const parsedId = leadIdSchema.safeParse(text(form, "leadId"));
  const parsedNoteId = leadIdSchema.safeParse(text(form, "noteId"));
  if (!parsedId.success || !parsedNoteId.success) return { supabase: null, message: "This note could not be identified." };
  const { context, supabase, error } = await editableLead(parsedId.data);
  if (error || !supabase) return { supabase: null, message: error ?? "Lead not found." };
  const { data: note, error: lookupError } = await supabase.from("notes").select("id, created_by")
    .eq("workspace_id", context.workspaceId).eq("related_entity_type", "lead")
    .eq("related_entity_id", parsedId.data).eq("id", parsedNoteId.data).maybeSingle();
  if (lookupError || !note) return { supabase: null, message: `Note could not be ${verb}d. Refresh the lead and try again.` };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && note.created_by !== context.userId) {
    return { supabase: null, message: `You can ${verb} only your own notes.` };
  }
  return { context, supabase, leadId: parsedId.data, noteId: parsedNoteId.data };
}

export async function updateLeadNoteAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const access = await modifiableLeadNote(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = leadNoteInputSchema.safeParse({ body: text(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { data, error } = await access.supabase.from("notes").update({ body: parsed.data.body })
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "lead")
    .eq("related_entity_id", access.leadId).eq("id", access.noteId).select("id").maybeSingle();
  if (error || !data) return { message: "Note could not be updated. Refresh the lead and try again." };
  revalidatePath(`/app/leads/${access.leadId}`);
  return { ok: true, message: "Note updated." };
}

export async function deleteLeadNoteAction(_previous: LeadEngagementActionState, form: FormData): Promise<LeadEngagementActionState> {
  const access = await modifiableLeadNote(form, "delete");
  if (!access.supabase) return { message: access.message };
  const { data, error } = await access.supabase.from("notes").delete()
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "lead")
    .eq("related_entity_id", access.leadId).eq("id", access.noteId).select("id").maybeSingle();
  if (error || !data) return { message: "Note could not be deleted. Refresh the lead and try again." };
  revalidatePath(`/app/leads/${access.leadId}`);
  return { ok: true, message: "Note deleted." };
}
