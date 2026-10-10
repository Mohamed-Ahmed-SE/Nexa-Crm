"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { dealIdSchema, dealInputSchema, lostDealOutcomeSchema, reopenDealOutcomeSchema, stageIdSchema, wonDealOutcomeSchema } from "@/lib/deals/schema";
import { getDealForEdit, insertDeal, updateDeal } from "@/lib/deals/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DealActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string[]> };
const failure = (message: string, fieldErrors?: Record<string, string[]>): DealActionResult => ({ ok: false, message, fieldErrors });
const textValue = (formData: FormData, key: string) => {
  const formEntry = formData.get(key);
  return typeof formEntry === "string" ? formEntry : "";
};
function parseForm(formData: FormData) {
  return dealInputSchema.safeParse({
    title: textValue(formData, "title"), companyId: textValue(formData, "companyId"), contactId: textValue(formData, "contactId"),
    amount: textValue(formData, "amount"), expectedCloseDate: textValue(formData, "expectedCloseDate"), ownerId: textValue(formData, "ownerId"),
    priority: textValue(formData, "priority"), description: textValue(formData, "description"), pipelineId: textValue(formData, "pipelineId"),
  });
}

async function verifyRelations(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, companyId: string | null, contactId: string | null) {
  if (companyId) {
    const { data: company, error } = await supabase.from("companies").select("id").eq("workspace_id", workspaceId).eq("id", companyId).is("archived_at", null).maybeSingle();
    if (error || !company) return false;
  }
  if (contactId) {
    const { data: contact, error } = await supabase.from("contacts").select("id, company_id").eq("workspace_id", workspaceId).eq("id", contactId).is("archived_at", null).maybeSingle();
    if (error || !contact || (contact.company_id && contact.company_id !== companyId)) return false;
  }
  return true;
}

async function verifyOwner(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, ownerId: string | null) {
  if (!ownerId) return true;
  const { data: eligibleMembers, error } = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: workspaceId, target_user_id: ownerId, target_lead_id: null });
  return !error && Boolean(eligibleMembers?.some(({ user_id }: { user_id: string }) => user_id === ownerId));
}

export async function createDealAction(formData: FormData): Promise<DealActionResult> {
  const context = await requirePermission("crm.create");
  const parsed = parseForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Authentication is not configured.");
  if (!await verifyRelations(supabase, context.workspaceId, parsed.data.companyId, parsed.data.contactId)) return failure("Choose a company and contact from this workspace, with a matching company.");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  const ownerId = canReassign ? parsed.data.ownerId : context.userId;
  if (canReassign && !await verifyOwner(supabase, context.workspaceId, ownerId)) return failure("Select an active owner in this workspace.");
  const { data: pipeline, error: pipelineError } = await supabase.from("pipelines").select("id").eq("workspace_id", context.workspaceId).eq("id", parsed.data.pipelineId).maybeSingle();
  if (pipelineError || !pipeline) return failure("The selected pipeline could not be verified in this workspace.");
  const { data: stage, error: stageError } = await supabase.from("pipeline_stages").select("id").eq("workspace_id", context.workspaceId).eq("pipeline_id", pipeline.id).eq("stage_type", "open").eq("is_active", true).order("position").limit(1).maybeSingle();
  if (stageError || !stage) return failure("There is no active open stage in the selected pipeline.");
  const { data: workspace, error: workspaceError } = await supabase.from("workspaces").select("default_currency").eq("id", context.workspaceId).maybeSingle();
  if (workspaceError || !workspace) return failure("Unable to verify workspace currency.");
  const { data: createdDeal, error } = await insertDeal(supabase, context.workspaceId, context.userId, pipeline.id, stage.id, workspace.default_currency, { ...parsed.data, ownerId });
  if (error || !createdDeal) return failure("Deal could not be created. Check your access and try again.");
  revalidateDeal(createdDeal.id);
  const logged = await logDealActivity({ supabase, workspaceId: context.workspaceId, userId: context.userId, dealId: createdDeal.id, activityType: "record_created", subject: "Deal created", body: null });
  return { ok: true, message: logged ? "Deal added." : "Deal added, but its activity could not be recorded." };
}

export async function updateDealAction(formData: FormData): Promise<DealActionResult> {
  const context = await requirePermission("crm.edit.own");
  const id = dealIdSchema.safeParse(textValue(formData, "id"));
  if (!id.success) return failure("This deal could not be identified.");
  const parsed = parseForm(formData);
  if (!parsed.success) return failure("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Authentication is not configured.");
  const { data: current, error } = await getDealForEdit(supabase, context.workspaceId, id.data);
  if (error || !current) return failure("Deal not found in this workspace.");
  if (current.status !== "open") return failure("Closed deals cannot be edited in this slice.");
  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  if (!canEditAll && current.owner_id !== context.userId) return failure("You can edit only deals assigned to you.");
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (parsed.data.ownerId !== current.owner_id && !canReassign) return failure("You do not have permission to reassign this deal.");
  if (canReassign && parsed.data.ownerId !== current.owner_id && !await verifyOwner(supabase, context.workspaceId, parsed.data.ownerId)) return failure("Select an active owner in this workspace.");
  if (!await verifyRelations(supabase, context.workspaceId, parsed.data.companyId, parsed.data.contactId)) return failure("Choose a company and contact from this workspace, with a matching company.");
  const { data: updated, error: updateError } = await updateDeal(supabase, context.workspaceId, id.data, { ...parsed.data, ownerId: parsed.data.ownerId });
  if (updateError) return failure("Deal could not be updated. Check your access and try again.");
  if (!updated) return failure("Deal not found or no longer editable.");
  revalidateDeal(id.data);
  const activitiesLogged = await logDealUpdateActivities({
    supabase, workspaceId: context.workspaceId, userId: context.userId, dealId: id.data,
    previousValues: { ownerId: current.owner_id, amount: current.amount, currency: current.currency },
    nextValues: { ownerId: parsed.data.ownerId, amount: parsed.data.amount },
  });
  return {
    ok: true,
    message: activitiesLogged ? "Deal updated." : "Deal updated, but an activity could not be recorded.",
  };
}

async function getEditableDeal(id: string) {
  const context = await requirePermission("crm.edit.own");
  if (!hasWorkspacePermission(context.role, "crm.edit.own") && !hasWorkspacePermission(context.role, "crm.edit.all")) return { error: "You do not have permission to change deal outcomes." } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Authentication is not configured." } as const;
  const { data: deal, error } = await getDealForEdit(supabase, context.workspaceId, id);
  if (error || !deal) return { error: "Deal not found in this workspace." } as const;
  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  if (!canEditAll && deal.owner_id !== context.userId) return { error: "You can change outcomes only for deals assigned to you." } as const;
  return { context, supabase, deal } as const;
}

function revalidateDeal(id: string) {
  revalidatePath("/app/deals");
  revalidatePath(`/app/deals/${id}`);
  revalidatePath("/app/tasks");
}

async function getDealOwnerLabel(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, ownerId: string | null) {
  if (!ownerId) return "Unassigned";
  try {
    const { data, error } = await supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
    return !error && data?.full_name ? data.full_name : "Workspace member";
  } catch {
    return "Workspace member";
  }
}

async function logDealUpdateActivities({
  supabase, workspaceId, userId, dealId, previousValues, nextValues,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  dealId: string;
  previousValues: { ownerId: string | null; amount: number; currency: string };
  nextValues: { ownerId: string | null; amount: number };
}) {
  const logged: boolean[] = [];
  if (previousValues.ownerId !== nextValues.ownerId) {
    const [previousOwner, nextOwner] = await Promise.all([
      getDealOwnerLabel(supabase, previousValues.ownerId), getDealOwnerLabel(supabase, nextValues.ownerId),
    ]);
    logged.push(await logDealActivity({
      supabase, workspaceId, userId, dealId, activityType: "owner_changed", subject: "Deal owner changed",
      body: `Owner changed from ${previousOwner} to ${nextOwner}.`,
      metadata: { old_owner_id: previousValues.ownerId, new_owner_id: nextValues.ownerId },
    }));
  }
  if (previousValues.amount !== nextValues.amount) logged.push(await logDealActivity({
    supabase, workspaceId, userId, dealId, activityType: "deal_value_changed", subject: "Deal value changed",
    body: `Deal value changed from ${previousValues.currency} ${previousValues.amount.toLocaleString()} to ${previousValues.currency} ${nextValues.amount.toLocaleString()}.`,
    metadata: { old_amount: previousValues.amount, new_amount: nextValues.amount, currency: previousValues.currency },
  }));
  return logged.every(Boolean);
}

async function logDealActivity({
  supabase, workspaceId, userId, dealId, activityType, subject, body, metadata = {},
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  userId: string;
  dealId: string;
  activityType: string;
  subject: string;
  body: string | null;
  metadata?: Record<string, string | number | null>;
}) {
  try {
    const { error } = await supabase.from("activities").insert({
      workspace_id: workspaceId, activity_type: activityType, subject, body, occurred_at: new Date().toISOString(),
      created_by: userId, owner_id: userId, related_entity_type: "deal", related_entity_id: dealId,
      metadata, is_system_event: false,
    });
    return !error;
  } catch {
    return false;
  }
}

async function handleLostTasks({ supabase, workspaceId, dealId, choice }: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  workspaceId: string;
  dealId: string;
  choice: "keep" | "complete" | "cancel";
}) {
  if (choice === "keep") return true;
  const { data: tasks, error: readError } = await supabase.from("tasks").select("id").eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("related_entity_id", dealId).eq("status", "open");
  if (readError) return false;
  const taskIds = (tasks ?? []).map(({ id }: { id: string }) => id);
  if (!taskIds.length) return true;
  const taskUpdate = choice === "complete"
    ? { status: "completed", completed_at: new Date().toISOString() }
    : { status: "cancelled", completed_at: null };
  const { data: updatedTasks, error } = await supabase.from("tasks").update(taskUpdate).eq("workspace_id", workspaceId).in("id", taskIds).eq("status", "open").select("id");
  return !error && (updatedTasks?.length ?? 0) === taskIds.length;
}

export async function markDealWonAction(formData: FormData): Promise<DealActionResult> {
  const parsed = wonDealOutcomeSchema.safeParse({ id: textValue(formData, "id"), amount: textValue(formData, "amount"), wonDate: textValue(formData, "wonDate"), note: textValue(formData, "note") });
  if (!parsed.success) return failure("Enter a valid final amount and won date.", parsed.error.flatten().fieldErrors);
  const editable = await getEditableDeal(parsed.data.id);
  if ("error" in editable) return failure(editable.error ?? "You do not have permission to update this deal.");
  if (editable.deal.status !== "open") return failure("Only open deals can be marked won.");
  const { data: stage, error: stageError } = await editable.supabase.from("pipeline_stages").select("id").eq("workspace_id", editable.context.workspaceId).eq("pipeline_id", editable.deal.pipeline_id).eq("stage_type", "won").eq("is_active", true).maybeSingle();
  if (stageError || !stage) return failure("An active Won stage is not available in this pipeline.");
  const { data: updated, error } = await editable.supabase.from("deals").update({ amount: parsed.data.amount, won_at: `${parsed.data.wonDate}T12:00:00.000Z`, stage_id: stage.id })
    .eq("workspace_id", editable.context.workspaceId).eq("id", editable.deal.id).eq("status", "open").is("archived_at", null).select("id").maybeSingle();
  if (error || !updated) return failure("The deal could not be marked won. Refresh and try again.");
  revalidateDeal(editable.deal.id);
  const logged = await logDealActivity({ supabase: editable.supabase, workspaceId: editable.context.workspaceId, userId: editable.context.userId, dealId: editable.deal.id, activityType: "deal_won", subject: "Deal marked won", body: parsed.data.note ?? null });
  return { ok: true, message: logged ? "Deal marked won." : "Deal marked won, but its activity could not be recorded." };
}

export async function markDealLostAction(formData: FormData): Promise<DealActionResult> {
  const parsed = lostDealOutcomeSchema.safeParse({ id: textValue(formData, "id"), lostReasonId: textValue(formData, "lostReasonId"), competitor: textValue(formData, "competitor"), note: textValue(formData, "note"), taskChoice: textValue(formData, "taskChoice") });
  if (!parsed.success) return failure("Choose a lost reason and task handling option.", parsed.error.flatten().fieldErrors);
  const editable = await getEditableDeal(parsed.data.id);
  if ("error" in editable) return failure(editable.error ?? "You do not have permission to update this deal.");
  if (editable.deal.status !== "open") return failure("Only open deals can be marked lost.");
  const { data: reason, error: reasonError } = await editable.supabase.from("lost_reasons").select("id, name").eq("workspace_id", editable.context.workspaceId).eq("id", parsed.data.lostReasonId).eq("is_active", true).maybeSingle();
  if (reasonError || !reason) return failure("Choose an active lost reason in this workspace.");
  const { data: stage, error: stageError } = await editable.supabase.from("pipeline_stages").select("id").eq("workspace_id", editable.context.workspaceId).eq("pipeline_id", editable.deal.pipeline_id).eq("stage_type", "lost").eq("is_active", true).maybeSingle();
  if (stageError || !stage) return failure("An active Lost stage is not available in this pipeline.");
  const { data: updated, error } = await editable.supabase.from("deals").update({ stage_id: stage.id, lost_reason_id: reason.id, lost_reason_text: parsed.data.competitor ?? null })
    .eq("workspace_id", editable.context.workspaceId).eq("id", editable.deal.id).eq("status", "open").is("archived_at", null).select("id").maybeSingle();
  if (error || !updated) return failure("The deal could not be marked lost. Refresh and try again.");
  revalidateDeal(editable.deal.id);
  const tasksHandled = await handleLostTasks({ supabase: editable.supabase, workspaceId: editable.context.workspaceId, dealId: editable.deal.id, choice: parsed.data.taskChoice });
  const details = [`Lost reason: ${reason.name}`, parsed.data.competitor ? `Competitor: ${parsed.data.competitor}` : null, parsed.data.note ? `Closing note: ${parsed.data.note}` : null].filter(Boolean).join("\n");
  const logged = await logDealActivity({ supabase: editable.supabase, workspaceId: editable.context.workspaceId, userId: editable.context.userId, dealId: editable.deal.id, activityType: "deal_lost", subject: "Deal marked lost", body: details });
  const warning = [!tasksHandled ? "Related tasks could not all be updated." : null, !logged ? "Activity could not be recorded." : null].filter(Boolean).join(" ");
  return { ok: true, message: warning ? `Deal marked lost. ${warning}` : "Deal marked lost." };
}

export async function reopenDealAction(formData: FormData): Promise<DealActionResult> {
  const parsed = reopenDealOutcomeSchema.safeParse({ id: textValue(formData, "id"), stageId: textValue(formData, "stageId") });
  if (!parsed.success) return failure("Choose an active open stage.", parsed.error.flatten().fieldErrors);
  const editable = await getEditableDeal(parsed.data.id);
  if ("error" in editable) return failure(editable.error ?? "You do not have permission to update this deal.");
  if (editable.deal.status === "open") return failure("This deal is already open.");
  const { data: stage, error: stageError } = await editable.supabase.from("pipeline_stages").select("id").eq("workspace_id", editable.context.workspaceId).eq("pipeline_id", editable.deal.pipeline_id).eq("id", parsed.data.stageId).eq("stage_type", "open").eq("is_active", true).maybeSingle();
  if (stageError || !stage) return failure("Choose an active open stage in this deal's pipeline.");
  const { data: updated, error } = await editable.supabase.from("deals").update({ stage_id: stage.id })
    .eq("workspace_id", editable.context.workspaceId).eq("id", editable.deal.id).neq("status", "open").is("archived_at", null).select("id").maybeSingle();
  if (error || !updated) return failure("The deal could not be reopened. Refresh and try again.");
  revalidateDeal(editable.deal.id);
  const logged = await logDealActivity({ supabase: editable.supabase, workspaceId: editable.context.workspaceId, userId: editable.context.userId, dealId: editable.deal.id, activityType: "deal_reopened", subject: "Deal reopened", body: null });
  return { ok: true, message: logged ? "Deal reopened." : "Deal reopened, but its activity could not be recorded." };
}

export async function moveDealStageAction(dealId: string, expectedStageId: string, destinationStageId: string): Promise<DealActionResult> {
  const context = await requirePermission("crm.edit.own");
  const validDeal = dealIdSchema.safeParse(dealId);
  const sourceStage = stageIdSchema.safeParse(expectedStageId);
  const destinationStage = stageIdSchema.safeParse(destinationStageId);
  if (!validDeal.success || !sourceStage.success || !destinationStage.success) return failure("Choose a valid open stage.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Authentication is not configured.");
  const { data: current, error } = await getDealForEdit(supabase, context.workspaceId, validDeal.data);
  if (error || !current || current.stage_id !== sourceStage.data || current.status !== "open") return failure("This deal changed before the move could be saved. Refresh and try again.");
  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  if (!canEditAll && current.owner_id !== context.userId) return failure("You can move only deals assigned to you.");
  const { data: target, error: targetError } = await supabase.from("pipeline_stages").select("id, name, stage_type").eq("workspace_id", context.workspaceId).eq("pipeline_id", current.pipeline_id).eq("id", destinationStage.data).eq("is_active", true).maybeSingle();
  if (targetError || !target || target.stage_type !== "open") return failure("Moves are available only between active open stages.");
  const { data: moved, error: moveError } = await supabase.from("deals").update({ stage_id: target.id }).eq("workspace_id", context.workspaceId).eq("id", current.id).eq("stage_id", sourceStage.data).eq("status", "open").is("archived_at", null).select("id").maybeSingle();
  if (moveError || !moved) return failure("The deal could not be moved. Its previous stage has been kept.");
  revalidateDeal(current.id);
  const logged = await logDealActivity({ supabase, workspaceId: context.workspaceId, userId: context.userId, dealId: current.id, activityType: "stage_changed", subject: `Stage changed to ${target.name}`, body: null });
  return { ok: true, message: logged ? "Deal moved." : "Deal moved, but its activity could not be recorded." };
}

