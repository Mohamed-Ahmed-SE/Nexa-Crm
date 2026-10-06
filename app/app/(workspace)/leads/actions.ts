"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { isRetainingRelation } from "@/lib/leads/relations";
import { leadIdSchema, leadInputSchema } from "@/lib/leads/schema";
import { leadConversionResultSchema, leadConversionSchema } from "@/lib/leads/conversion-schema";
import { getLeadForEdit, saveLead } from "@/lib/leads/repository";
import { deleteLeadViewAction as deleteSavedView, saveLeadViewAction as saveSavedView, type SavedViewActionState as LeadActionState } from "./saved-view-actions";
export type { SavedViewActionState as LeadActionState } from "./saved-view-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { error } = await saveLead(supabase, context.workspaceId, context.userId, { ...parsed.data, ownerId, currency: workspace.default_currency });
  if (error) return { message: "Lead could not be created. Check your access and try again." };
  revalidatePath("/app/leads");
  return { ok: true, message: "Lead added." };
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

  const parsedCreatedRecordIds = leadConversionResultSchema.safeParse(createdRecordPayload);
  revalidatePath("/app/leads");
  revalidatePath("/app/deals");
  revalidatePath("/app/contacts");
  revalidatePath("/app/companies");
  if (!parsedCreatedRecordIds.success) {
    return { ok: true, conversionCompleted: true, message: "Conversion completed, but its record links could not be verified. The workspace will refresh." };
  }
  return { ok: true, conversionCompleted: true, message: "Lead converted.", ...parsedCreatedRecordIds.data };
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
  revalidatePath("/app/leads");
  return { ok: true, message: "Lead updated." };
}
