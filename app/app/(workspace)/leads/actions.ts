"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { isRetainingRelation } from "@/lib/leads/relations";
import { bulkLeadIdsSchema, bulkLeadTagSchema, leadIdSchema, leadInputSchema, statusLabels, type LeadFilterStatus } from "@/lib/leads/schema";
import { leadConversionResultSchema, leadConversionSchema } from "@/lib/leads/conversion-schema";
import { getLeadForEdit, saveLead } from "@/lib/leads/repository";
import { findLeadDuplicates, normalizeLeadEmail, normalizeLeadPhone, type LeadDuplicateCandidate, type LeadDuplicateMatch } from "@/lib/leads/duplicates";
import { deleteLeadViewAction as deleteSavedView, saveLeadViewAction as saveSavedView, type SavedViewActionState } from "./saved-view-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LeadActionState = SavedViewActionState & { duplicateMatches?: LeadDuplicateMatch[] };

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseForm(formData: FormData) {
  return leadInputSchema.safeParse({
    fullName: textValue(formData, "fullName"),
    companyName: textValue(formData, "companyName"),
    email: textValue(formData, "email"),
    phone: textValue(formData, "phone"),
    jobTitle: textValue(formData, "jobTitle"),
    sourceId: textValue(formData, "sourceId"),
    status: textValue(formData, "status"),
    ownerId: textValue(formData, "ownerId"),
    estimatedValue: textValue(formData, "estimatedValue"),
    notesSummary: textValue(formData, "notesSummary"),
  });
}

async function verifySource(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  workspaceId: string,
  sourceId: string | null,
  currentSourceId: string | null = null,
) {
  if (!sourceId) return true;
  let query = supabase.from("lead_sources").select("id")
    .eq("id", sourceId)
    .eq("workspace_id", workspaceId);
  if (!isRetainingRelation(sourceId, currentSourceId)) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data);
}

async function verifyOwner(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  workspaceId: string,
  ownerId: string | null,
  leadId: string | null = null,
) {
  if (!ownerId) return true;
  const { data, error } = await supabase.rpc("list_reassignable_workspace_members", {
    target_workspace_id: workspaceId,
    target_user_id: ownerId,
    target_lead_id: leadId,
  });
  return !error && Boolean(data?.some((member: { user_id: string }) => member.user_id === ownerId));
}

export async function createLeadAction(_previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await requirePermission("crm.create");
  const parsed = parseForm(formData);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };

  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const ownerId = canReassign ? parsed.data.ownerId : context.userId;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  if (!await verifySource(supabase, context.workspaceId, parsed.data.sourceId)) return { message: "Select an active lead source in this workspace." };
  if (canReassign && !await verifyOwner(supabase, context.workspaceId, ownerId)) return { message: "Select an active owner in this workspace." };
  const { data: workspace, error: workspaceError } = await supabase.from("workspaces").select("default_currency").eq("id", context.workspaceId).maybeSingle();
  if (workspaceError || !workspace) return { message: "Unable to verify workspace currency." };

  const email = normalizeLeadEmail(parsed.data.email);
  const phone = normalizeLeadPhone(parsed.data.phone);
  if (email || phone) {
    const { data: candidates, error: duplicateLookupError } = await supabase.from("leads")
      .select("id,full_name,email,phone")
      .eq("workspace_id", context.workspaceId)
      .is("archived_at", null);
    if (!duplicateLookupError) {
      const duplicateMatches = findLeadDuplicates((candidates ?? []) as LeadDuplicateCandidate[], email, phone);
      if (duplicateMatches.length && textValue(formData, "confirmDuplicate") !== "true") return { duplicateMatches };
    }
  }

  const { data: createdLead, error } = await saveLead(supabase, context.workspaceId, context.userId, { ...parsed.data, ownerId, currency: workspace.default_currency });
  if (error || !createdLead?.id) return { message: "Lead could not be created. Check your access and try again." };
  revalidatePath("/app/leads");
  const logged = await logLeadCreation(supabase, context.workspaceId, context.userId, createdLead.id);
  return logged
    ? { ok: true, message: "Lead added." }
    : { ok: true, message: "Lead added, but its activity could not be recorded." };
}

async function logLeadCreation(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  workspaceId: string,
  userId: string,
  leadId: string,
) {
  try {
    const { error } = await supabase.from("activities").insert({
      workspace_id: workspaceId, activity_type: "record_created", subject: "Lead created",
      occurred_at: new Date().toISOString(), created_by: userId, owner_id: userId,
      related_entity_type: "lead", related_entity_id: leadId, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function saveLeadViewAction(previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  return saveSavedView(previous, formData);
}

export async function deleteLeadViewAction(previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  return deleteSavedView(previous, formData);
}

export type ConvertLeadActionState = LeadActionState & {
  conversionCompleted?: boolean;
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
};

function parseConversionForm(formData: FormData) {
  return leadConversionSchema.safeParse({
    createContact: formData.get("createContact") === "on",
    createCompany: formData.get("createCompany") === "on",
    createDeal: formData.get("createDeal") === "on",
    contactFirstName: textValue(formData, "contactFirstName"),
    contactLastName: textValue(formData, "contactLastName"),
    companyName: textValue(formData, "companyName"),
    dealTitle: textValue(formData, "dealTitle"),
    pipelineId: textValue(formData, "pipelineId"),
    stageId: textValue(formData, "stageId"),
    dealOwnerId: textValue(formData, "dealOwnerId"),
    dealValue: textValue(formData, "dealValue"),
    closeDate: textValue(formData, "closeDate"),
  });
}

export async function convertLeadAction(formData: FormData): Promise<ConvertLeadActionState> {
  const context = await requirePermission("crm.edit.own");
  const leadId = leadIdSchema.safeParse(textValue(formData, "id"));
  if (!leadId.success) return { message: "This lead could not be identified." };
  const parsedConversion = parseConversionForm(formData);
  if (!parsedConversion.success) return { message: "Check the conversion options and try again.", fieldErrors: parsedConversion.error.flatten().fieldErrors };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: lead, error: leadError } = await getLeadForEdit(supabase, context.workspaceId, leadId.data);
  if (leadError || !lead) return { message: "Lead not found in this workspace." };
  if (lead.status === "converted") return { message: "This lead has already been converted." };
  if (!hasWorkspacePermission(context.role, "crm.edit.all") && lead.owner_id !== context.userId) {
    return { message: "You can convert only leads assigned to you." };
  }
  if (parsedConversion.data.createDeal) {
    if (!hasWorkspacePermission(context.role, "crm.reassign") && parsedConversion.data.dealOwnerId !== context.userId) {
      return { message: "You may assign a deal only to yourself." };
    }
    if (hasWorkspacePermission(context.role, "crm.reassign") && !await verifyOwner(
      supabase,
      context.workspaceId,
      parsedConversion.data.dealOwnerId,
    )) {
      return { message: "Select an active deal owner in this workspace." };
    }
  }

  const { data: createdRecordPayload, error: conversionError } = await supabase.rpc("convert_lead", {
    target_workspace_id: context.workspaceId,
    target_lead_id: leadId.data,
    conversion: parsedConversion.data,
  });
  if (conversionError) return { message: "Lead conversion failed. No records were created; review the options and try again." };

  const statusActivityLogged = await logLeadStatusChange(
    supabase, context.workspaceId, context.userId, leadId.data, lead.status, "converted",
  );
  const parsedCreatedRecordIds = leadConversionResultSchema.safeParse(createdRecordPayload);
  revalidatePath("/app/leads");
  revalidatePath("/app/deals");
  revalidatePath("/app/contacts");
  revalidatePath("/app/companies");
  if (!parsedCreatedRecordIds.success) {
    const activityWarning = statusActivityLogged ? "" : " Its status-change activity could not be recorded.";
    return { ok: true, conversionCompleted: true, message: `Conversion completed, but its record links could not be verified.${activityWarning} The workspace will refresh.` };
  }
  return statusActivityLogged
    ? { ok: true, conversionCompleted: true, message: "Lead converted.", ...parsedCreatedRecordIds.data }
    : { ok: true, conversionCompleted: true, message: "Lead converted, but its status-change activity could not be recorded.", ...parsedCreatedRecordIds.data };
}

function parseBulkLeadIds(formData: FormData) {
  const leadIds = formData.getAll("leadIds");
  if (leadIds.some((id) => typeof id !== "string")) return null;
  const parsed = bulkLeadIdsSchema.safeParse(leadIds);
  return parsed.success ? parsed.data : null;
}

type LeadSelectionRequest = {
  workspaceId: string;
  leadIds: string[];
  allowedOwnerId: string | null;
};

async function verifySelectedLeads(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  { workspaceId, leadIds, allowedOwnerId }: LeadSelectionRequest,
) {
  const { data: leads, error } = await supabase.from("leads").select("id, owner_id")
    .eq("workspace_id", workspaceId).is("archived_at", null).in("id", leadIds);
  if (error || leads?.length !== leadIds.length) return false;
  return allowedOwnerId === null || leads.every((lead) => lead.owner_id === allowedOwnerId);
}

export async function bulkAssignLeadsAction(_previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await requirePermission("crm.reassign");
  const leadIds = parseBulkLeadIds(formData);
  const requestedOwnerId = textValue(formData, "ownerId");
  const ownerId = requestedOwnerId ? leadIdSchema.safeParse(requestedOwnerId) : { success: true as const, data: null };
  if (!leadIds || !ownerId.success) return { message: "Select up to 25 valid leads and an active workspace owner." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  if (ownerId.data && !await verifyOwner(supabase, context.workspaceId, ownerId.data)) {
    return { message: "Select an active owner in this workspace." };
  }
  if (!await verifySelectedLeads(supabase, { workspaceId: context.workspaceId, leadIds, allowedOwnerId: null })) {
    return { message: "Some selected leads are unavailable. Refresh the list and try again." };
  }
  const { data: updated, error } = await supabase.from("leads").update({ owner_id: ownerId.data })
    .eq("workspace_id", context.workspaceId).is("archived_at", null).in("id", leadIds).select("id");
  if (error) return { message: "No leads were reassigned. Refresh the list and try again." };
  if (updated?.length !== leadIds.length) {
    if (updated?.length) return { message: `Only ${updated.length} of ${leadIds.length} leads were reassigned. Refresh and review the list.` };
    return { message: "No leads were reassigned. Refresh the list and try again." };
  }
  revalidatePath("/app/leads");
  return { ok: true, message: `Assigned ${updated.length} leads.` };
}

export async function bulkTagLeadsAction(_previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await requirePermission("crm.edit.own");
  const parsed = bulkLeadTagSchema.safeParse({ leadIds: parseBulkLeadIds(formData), tagId: textValue(formData, "tagId") });
  if (!parsed.success) return { message: "Select up to 25 valid leads and a workspace tag." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const allowedOwnerId = hasWorkspacePermission(context.role, "crm.edit.all") ? null : context.userId;
  if (!await verifySelectedLeads(supabase, {
    workspaceId: context.workspaceId, leadIds: parsed.data.leadIds, allowedOwnerId,
  })) {
    return { message: "Some selected leads are unavailable or not assigned to you. Refresh the list and try again." };
  }
  const { data: tag, error: tagError } = await supabase.from("tags").select("id")
    .eq("workspace_id", context.workspaceId).eq("id", parsed.data.tagId).maybeSingle();
  if (tagError || !tag) return { message: "Select an existing tag in this workspace." };

  const { data: existing, error: existingError } = await supabase.from("entity_tags").select("entity_id")
    .eq("workspace_id", context.workspaceId).eq("entity_type", "lead").eq("tag_id", tag.id).in("entity_id", parsed.data.leadIds);
  if (existingError) return { message: "Unable to check existing lead tags. No changes were made." };
  const existingIds = new Set((existing ?? []).map(({ entity_id }) => entity_id));
  const additions = parsed.data.leadIds.filter((id) => !existingIds.has(id))
    .map((entity_id) => ({ workspace_id: context.workspaceId, tag_id: tag.id, entity_type: "lead", entity_id }));
  if (additions.length) {
    const { data: inserted, error: insertError } = await supabase.from("entity_tags").insert(additions).select("entity_id");
    if (insertError || inserted?.length !== additions.length) {
      if (inserted?.length) {
        const { error: cleanupError } = await supabase.from("entity_tags").delete().eq("workspace_id", context.workspaceId)
          .eq("entity_type", "lead").eq("tag_id", tag.id).in("entity_id", inserted.map(({ entity_id }) => entity_id));
        if (cleanupError) return { message: "Tagging was incomplete and some changes may remain. Refresh the list and review selected leads." };
      }
      return { message: "No new tags were added. Existing lead tags remain unchanged. Check your access and try again." };
    }
  }
  revalidatePath("/app/leads");
  return { ok: true, message: `Tag is present on all ${parsed.data.leadIds.length} selected leads.` };
}

async function getLeadOwnerLabel(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  ownerId: string | null,
) {
  if (!ownerId) return "Unassigned";
  try {
    const { data, error } = await supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
    const label = data?.full_name?.trim();
    const isUuidLabel = label && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label);
    return !error && label && !isUuidLabel ? label : "Workspace member";
  } catch {
    return "Workspace member";
  }
}

type LeadOwnerChangeActivity = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  leadId: string;
  oldOwnerId: string | null;
  newOwnerId: string | null;
  oldOwner: string;
  newOwner: string;
};

async function insertLeadOwnerChangeActivity(input: LeadOwnerChangeActivity) {
  try {
    const { error } = await input.supabase.from("activities").insert({
      workspace_id: input.workspaceId, activity_type: "owner_changed",
      subject: "Lead owner changed", body: `Lead owner changed from ${input.oldOwner} to ${input.newOwner}.`,
      occurred_at: new Date().toISOString(), created_by: input.userId, owner_id: input.userId,
      related_entity_type: "lead", related_entity_id: input.leadId,
      metadata: { old_owner_id: input.oldOwnerId, new_owner_id: input.newOwnerId }, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

async function logLeadOwnerChange({
  supabase, workspaceId, userId, leadId, oldOwnerId, newOwnerId,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  leadId: string;
  oldOwnerId: string | null;
  newOwnerId: string | null;
}) {
  const [oldOwner, newOwner] = await Promise.all([
    getLeadOwnerLabel(supabase, oldOwnerId), getLeadOwnerLabel(supabase, newOwnerId),
  ]);
  return insertLeadOwnerChangeActivity({
    supabase, workspaceId, userId, leadId, oldOwnerId, newOwnerId, oldOwner, newOwner,
  });
}

async function logLeadStatusChange(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  workspaceId: string,
  userId: string,
  leadId: string,
  oldStatus: LeadFilterStatus,
  newStatus: LeadFilterStatus,
) {
  try {
    const { error } = await supabase.from("activities").insert({
      workspace_id: workspaceId, activity_type: "status_changed", subject: "Lead status changed",
      body: `Lead status changed from ${statusLabels[oldStatus]} to ${statusLabels[newStatus]}.`, occurred_at: new Date().toISOString(),
      created_by: userId, owner_id: userId, related_entity_type: "lead", related_entity_id: leadId,
      metadata: { old_status: oldStatus, new_status: newStatus }, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function updateLeadAction(_previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await requirePermission("crm.edit.own");
  const parsedId = leadIdSchema.safeParse(textValue(formData, "id"));
  if (!parsedId.success) return { message: "This lead could not be identified." };
  const parsed = parseForm(formData);
  if (!parsed.success) return { message: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: current, error: currentError } = await getLeadForEdit(supabase, context.workspaceId, parsedId.data);
  if (currentError || !current) return { message: "Lead not found in this workspace." };
  if (!await verifySource(supabase, context.workspaceId, parsed.data.sourceId, current.source_id)) {
    return { message: "Select an active lead source in this workspace." };
  }

  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  if (!canEditAll && current.owner_id !== context.userId) return { message: "You can edit only leads assigned to you." };
  if (current.status === "converted") return { message: "Converted leads cannot be edited." };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (parsed.data.ownerId !== current.owner_id && !canReassign) {
    return { message: "You do not have permission to reassign this lead." };
  }
  if (canReassign && !await verifyOwner(
    supabase,
    context.workspaceId,
    parsed.data.ownerId,
    isRetainingRelation(parsed.data.ownerId, current.owner_id) ? current.id : null,
  )) {
    return { message: "Select an active owner in this workspace." };
  }

  const { data: updated, error } = await saveLead(supabase, context.workspaceId, context.userId, { ...parsed.data, id: parsedId.data, currency: current.currency });
  if (error) return { message: "Lead could not be updated. Check your access and try again." };
  if (!updated) return { message: "Lead not found or no longer editable." };
  const ownerChanged = current.owner_id !== parsed.data.ownerId;
  const statusChanged = current.status !== parsed.data.status;
  const ownerActivityLogged = !ownerChanged || await logLeadOwnerChange({
    supabase,
    workspaceId: context.workspaceId,
    userId: context.userId,
    leadId: parsedId.data,
    oldOwnerId: current.owner_id,
    newOwnerId: parsed.data.ownerId,
  });
  const statusActivityLogged = !statusChanged || await logLeadStatusChange(
    supabase, context.workspaceId, context.userId, parsedId.data, current.status, parsed.data.status,
  );
  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${parsedId.data}`);
  if (!ownerActivityLogged && !statusActivityLogged) {
    return { ok: true, message: "Lead updated, but one or more activities could not be recorded." };
  }
  if (!ownerActivityLogged || !statusActivityLogged) {
    return { ok: true, message: "Lead updated, but an activity could not be recorded." };
  }
  return { ok: true, message: "Lead updated." };
}
