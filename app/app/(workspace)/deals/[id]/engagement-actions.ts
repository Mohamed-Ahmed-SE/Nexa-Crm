"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";
import { dealActivityInputSchema, dealNoteInputSchema, dealTaskInputSchema } from "@/lib/deals/engagement-schema";
import { dealIdSchema } from "@/lib/deals/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activityModificationError, deleteManualActivity, updateManualActivity, type ActivityTarget, type ActivityVerb } from "@/lib/activities/modify";

export type DealEngagementActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
const text = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
};

async function editableDeal(dealId: string) {
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { context, supabase, error: "Authentication is not configured." };
  const { data: deal, error } = await supabase.from("deals").select("id, owner_id, status")
    .eq("workspace_id", context.workspaceId).eq("id", dealId).is("archived_at", null).maybeSingle();
  if (error || !deal) return { context, supabase, error: "Deal not found in this workspace." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && deal.owner_id !== context.userId) {
    return { context, supabase, error: "You can update only deals assigned to you." };
  }
  return { context, supabase, deal, error: null };
}

export async function logDealActivityAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  if (!parsedId.success) return { message: "This deal could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase) return { message: editable.error ?? "Deal not found." };
  const parsed = dealActivityInputSchema.safeParse({
    type: text(form, "type"), subject: text(form, "subject"), body: text(form, "body"),
    occurredAt: normalizeContactDateTime(text(form, "occurredAt"), text(form, "timezoneOffset")),
  });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error } = await editable.supabase.from("activities").insert({
    workspace_id: editable.context.workspaceId, activity_type: parsed.data.type, subject: parsed.data.subject,
    body: parsed.data.body, occurred_at: parsed.data.occurredAt, created_by: editable.context.userId,
    owner_id: editable.context.userId, related_entity_type: "deal", related_entity_id: parsedId.data,
    metadata: {}, is_system_event: false,
  });
  if (error) return { message: "Activity could not be saved." };
  revalidatePath(`/app/deals/${parsedId.data}`);
  return { ok: true, message: "Activity logged." };
}

async function modifiableDealActivity(form: FormData, verb: ActivityVerb) {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  const parsedActivityId = dealIdSchema.safeParse(text(form, "activityId"));
  if (!parsedId.success || !parsedActivityId.success) return { supabase: null, message: "This activity could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase) return { supabase: null, message: editable.error ?? "Deal not found." };
  const { context, supabase } = editable;
  const target: ActivityTarget = { workspaceId: context.workspaceId, entityType: "deal", entityId: parsedId.data, activityId: parsedActivityId.data };
  const message = await activityModificationError(supabase, { target, role: context.role, userId: context.userId, verb, entityLabel: "deal" });
  return message ? { supabase: null, message } : { supabase, target };
}

export async function updateDealActivityAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const access = await modifiableDealActivity(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = dealActivityInputSchema.safeParse({
    type: text(form, "type"), subject: text(form, "subject"), body: text(form, "body"),
    occurredAt: normalizeContactDateTime(text(form, "occurredAt"), text(form, "timezoneOffset")),
  });
  if (!parsed.success) return { message: "Check the activity details.", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!await updateManualActivity(access.supabase, access.target, parsed.data)) return { message: "Activity could not be updated. Refresh the deal and try again." };
  revalidatePath(`/app/deals/${access.target.entityId}`);
  return { ok: true, message: "Activity updated." };
}

export async function deleteDealActivityAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const access = await modifiableDealActivity(form, "delete");
  if (!access.supabase) return { message: access.message };
  if (!await deleteManualActivity(access.supabase, access.target)) return { message: "Activity could not be deleted. Refresh the deal and try again." };
  revalidatePath(`/app/deals/${access.target.entityId}`);
  return { ok: true, message: "Activity deleted." };
}

export async function addDealNoteAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  if (!parsedId.success) return { message: "This deal could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase) return { message: editable.error ?? "Deal not found." };
  const parsed = dealNoteInputSchema.safeParse({ body: text(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { error } = await editable.supabase.from("notes").insert({
    workspace_id: editable.context.workspaceId, body: parsed.data.body, is_pinned: false,
    created_by: editable.context.userId, related_entity_type: "deal", related_entity_id: parsedId.data,
  });
  if (error) return { message: "Note could not be saved." };
  revalidatePath(`/app/deals/${parsedId.data}`);
  return { ok: true, message: "Note added." };
}

export async function toggleDealNotePinAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  if (!parsedId.success) return { message: "This deal could not be identified." };
  const parsedNoteId = dealIdSchema.safeParse(text(form, "noteId"));
  if (!parsedNoteId.success) return { message: "This note could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase) return { message: editable.error ?? "Deal not found." };
  const noteId = parsedNoteId.data;
  const { data: note, error: noteError } = await editable.supabase.from("notes").select("id, is_pinned, created_by")
    .eq("workspace_id", editable.context.workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", parsedId.data).eq("id", noteId).maybeSingle();
  if (noteError || !note) return { message: "Note not found in this workspace." };
  if (!hasWorkspacePermission(editable.context.role, "crm.edit.all") && note.created_by !== editable.context.userId) {
    return { message: "You can update only your own notes." };
  }
  const { data, error } = await editable.supabase.from("notes").update({ is_pinned: !note.is_pinned })
    .eq("workspace_id", editable.context.workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", parsedId.data).eq("id", noteId).select("id").maybeSingle();
  if (error || !data) return { message: "Note could not be updated." };
  revalidatePath(`/app/deals/${parsedId.data}`);
  return { ok: true, message: note.is_pinned ? "Note unpinned." : "Note pinned." };
}

async function modifiableDealNote(form: FormData, verb: "update" | "delete") {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  const parsedNoteId = dealIdSchema.safeParse(text(form, "noteId"));
  if (!parsedId.success || !parsedNoteId.success) return { supabase: null, message: "This note could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase) return { supabase: null, message: editable.error ?? "Deal not found." };
  const { context, supabase } = editable;
  const { data: note, error: lookupError } = await supabase.from("notes").select("id, created_by")
    .eq("workspace_id", context.workspaceId).eq("related_entity_type", "deal")
    .eq("related_entity_id", parsedId.data).eq("id", parsedNoteId.data).maybeSingle();
  if (lookupError || !note) return { supabase: null, message: `Note could not be ${verb}d. Refresh the deal and try again.` };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && note.created_by !== context.userId) {
    return { supabase: null, message: `You can ${verb} only your own notes.` };
  }
  return { context, supabase, dealId: parsedId.data, noteId: parsedNoteId.data };
}

export async function updateDealNoteAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const access = await modifiableDealNote(form, "update");
  if (!access.supabase) return { message: access.message };
  const parsed = dealNoteInputSchema.safeParse({ body: text(form, "body") });
  if (!parsed.success) return { message: "Enter a note before saving.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { data, error } = await access.supabase.from("notes").update({ body: parsed.data.body })
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "deal")
    .eq("related_entity_id", access.dealId).eq("id", access.noteId).select("id").maybeSingle();
  if (error || !data) return { message: "Note could not be updated. Refresh the deal and try again." };
  revalidatePath(`/app/deals/${access.dealId}`);
  return { ok: true, message: "Note updated." };
}

export async function deleteDealNoteAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const access = await modifiableDealNote(form, "delete");
  if (!access.supabase) return { message: access.message };
  const { data, error } = await access.supabase.from("notes").delete()
    .eq("workspace_id", access.context.workspaceId).eq("related_entity_type", "deal")
    .eq("related_entity_id", access.dealId).eq("id", access.noteId).select("id").maybeSingle();
  if (error || !data) return { message: "Note could not be deleted. Refresh the deal and try again." };
  revalidatePath(`/app/deals/${access.dealId}`);
  return { ok: true, message: "Note deleted." };
}

export async function createDealFollowUpTaskAction(_previous: DealEngagementActionState, form: FormData): Promise<DealEngagementActionState> {
  const parsedId = dealIdSchema.safeParse(text(form, "dealId"));
  if (!parsedId.success) return { message: "This deal could not be identified." };
  const editable = await editableDeal(parsedId.data);
  if (editable.error || !editable.supabase || !editable.deal) return { message: editable.error ?? "Deal not found." };
  if (editable.deal.status !== "open") return { message: "Follow-up tasks can be created only for open deals." };
  const parsed = dealTaskInputSchema.safeParse({
    title: text(form, "title"), description: text(form, "description"), type: text(form, "type"),
    priority: text(form, "priority"), dueAt: normalizeContactDateTime(text(form, "dueAt"), text(form, "timezoneOffset")),
    assignedTo: text(form, "assignedTo"),
  });
  if (!parsed.success) return { message: "Check the task details and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const canReassign = hasWorkspacePermission(editable.context.role, "crm.reassign");
  if (parsed.data.assignedTo && parsed.data.assignedTo !== editable.context.userId && !canReassign) {
    return { message: "You can assign tasks only to yourself." };
  }
  const assignedTo = canReassign ? parsed.data.assignedTo : editable.context.userId;
  if (assignedTo) {
    const { data: members, error } = await editable.supabase.rpc("list_reassignable_workspace_members", {
      target_workspace_id: editable.context.workspaceId, target_user_id: assignedTo, target_lead_id: null,
    });
    if (error || !members?.some(({ user_id }: { user_id: string }) => user_id === assignedTo)) {
      return { message: "Choose an active member of this workspace." };
    }
  }
  const { error } = await editable.supabase.from("tasks").insert({
    workspace_id: editable.context.workspaceId, created_by: editable.context.userId, assigned_to: assignedTo,
    title: parsed.data.title, description: parsed.data.description, task_type: parsed.data.type,
    priority: parsed.data.priority, due_at: parsed.data.dueAt, status: "open",
    related_entity_type: "deal", related_entity_id: parsedId.data,
  });
  if (error) return { message: "Unable to create this task. Check that the deal is available to you." };
  revalidatePath(`/app/deals/${parsedId.data}`);
  revalidatePath("/app/tasks");
  return { ok: true, message: "Follow-up task created." };
}
