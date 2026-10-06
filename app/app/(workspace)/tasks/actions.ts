"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { createTaskSchema, rescheduleTaskSchema, taskIdSchema } from "@/lib/tasks/schema";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TaskActionState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> };
const value = (form: FormData, key: string) => { const entry = form.get(key); return typeof entry === "string" ? entry : ""; };

export async function createTaskAction(_previous: TaskActionState, form: FormData): Promise<TaskActionState> {
  const context = await requirePermission("crm.create");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const parsed = createTaskSchema.safeParse({
    title: value(form, "title"), description: value(form, "description"), type: value(form, "type"), priority: value(form, "priority"),
    dueAt: normalizeContactDateTime(value(form, "dueAt"), value(form, "timezoneOffset")), assignedTo: value(form, "assignedTo"),
    relatedType: value(form, "relatedType"), relatedId: value(form, "relatedId"),
  });
  if (!parsed.success) return { message: "Check the task details and try again.", fieldErrors: parsed.error.flatten().fieldErrors };
  const canReassign = hasWorkspacePermission(context.role, "crm.reassign");
  if (parsed.data.assignedTo && parsed.data.assignedTo !== context.userId && !canReassign) return { message: "You can assign tasks only to yourself." };
  const assignedTo = canReassign ? parsed.data.assignedTo : context.userId;
  if (assignedTo) {
    const { data: members, error } = await supabase.rpc("list_reassignable_workspace_members", { target_workspace_id: context.workspaceId, target_user_id: assignedTo, target_lead_id: null });
    if (error || !members?.some((member: { user_id: string }) => member.user_id === assignedTo)) return { message: "Choose an active member of this workspace." };
  }
  if (parsed.data.relatedType && parsed.data.relatedId && !await validRelation(supabase, context.workspaceId, context.userId, canReassign, parsed.data.relatedType, parsed.data.relatedId)) return { message: "Choose an active related record in this workspace that you can access." };

  const { error } = await supabase.from("tasks").insert({
    workspace_id: context.workspaceId, created_by: context.userId, assigned_to: assignedTo, title: parsed.data.title,
    description: parsed.data.description, task_type: parsed.data.type, priority: parsed.data.priority, due_at: parsed.data.dueAt,
    status: "open", related_entity_type: parsed.data.relatedType, related_entity_id: parsed.data.relatedId,
  });
  if (error) return { message: "Unable to create this task. Check that the related record is available to you." };
  revalidatePath("/app/tasks");
  return { ok: true, message: "Task created." };
}

export async function rescheduleTaskAction(taskId: string, form: FormData): Promise<TaskActionState> {
  const parsedId = taskIdSchema.safeParse(taskId);
  if (!parsedId.success) return { message: "This task could not be identified." };
  const context = await requirePermission("crm.edit.own");
  const parsedDate = rescheduleTaskSchema.safeParse({ dueAt: value(form, "dueAt"), timezoneOffset: value(form, "timezoneOffset"), timeZone: value(form, "timeZone") });
  if (!parsedDate.success) return { message: "Enter a valid due date and time.", fieldErrors: parsedDate.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: task, error: taskError } = await supabase.from("tasks").select("id,status,assigned_to,related_entity_type,related_entity_id").eq("workspace_id", context.workspaceId).eq("id", parsedId.data).maybeSingle();
  if (taskError || !task || task.status !== "open") return { message: "This open task could not be found in your workspace." };
  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  const ownsRelated = task.related_entity_type && task.related_entity_id ? await isRelationOwnedBy(supabase, context.workspaceId, context.userId, task.related_entity_type, task.related_entity_id) : false;
  if (!canEditAll && task.assigned_to !== context.userId && !ownsRelated) return { message: "You can reschedule only tasks assigned to you or linked to a record you own." };

  const { data: updated, error: updateError } = await supabase.from("tasks").update({ due_at: parsedDate.data.dueAt }).eq("workspace_id", context.workspaceId).eq("id", parsedId.data).eq("status", "open").select("id").maybeSingle();
  if (updateError || !updated) return { message: "Task could not be rescheduled. Refresh and try again." };
  revalidatePath("/app/tasks");
  if (task.related_entity_type && task.related_entity_id) revalidatePath(relationPath(task.related_entity_type, task.related_entity_id));
  return { ok: true, message: "Task rescheduled." };
}

export async function completeTaskAction(taskId: string): Promise<TaskActionState> {
  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) return { message: "This task could not be identified." };
  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const { data: task, error: taskError } = await supabase.from("tasks").select("id,title,status,assigned_to,related_entity_type,related_entity_id").eq("workspace_id", context.workspaceId).eq("id", id.data).maybeSingle();
  if (taskError || !task || task.status !== "open") return { message: "This open task could not be found in your workspace." };
  const canEditAll = hasWorkspacePermission(context.role, "crm.edit.all");
  const ownsRelated = task.related_entity_type && task.related_entity_id ? await isRelationOwnedBy(supabase, context.workspaceId, context.userId, task.related_entity_type, task.related_entity_id) : false;
  if (!canEditAll && task.assigned_to !== context.userId && !ownsRelated) return { message: "You can complete only tasks assigned to you or linked to a record you own." };

  const completedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase.from("tasks").update({ status: "completed", completed_at: completedAt }).eq("workspace_id", context.workspaceId).eq("id", id.data).eq("status", "open").select("id").maybeSingle();
  if (updateError || !updated) return { message: "Task could not be completed. Refresh and try again." };
  revalidatePath("/app/tasks");
  let message = "Task completed.";
  if (task.related_entity_type && task.related_entity_id) {
    const { error: activityError } = await supabase.from("activities").insert({
      workspace_id: context.workspaceId, activity_type: "task_completed", subject: "Task completed", body: task.title,
      occurred_at: completedAt, created_by: context.userId, owner_id: context.userId,
      related_entity_type: task.related_entity_type, related_entity_id: task.related_entity_id,
      metadata: { task_id: task.id }, is_system_event: false,
    });
    if (activityError) message = "Task completed, but its activity could not be recorded for that related record.";
    else revalidatePath(relationPath(task.related_entity_type, task.related_entity_id));
  } else {
    message = "Task completed. Unlinked tasks have no record timeline for an activity entry.";
  }
  return { ok: true, message };
}

async function validRelation(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, userId: string, canReassign: boolean, type: "company" | "contact" | "lead" | "deal", id: string) {
  const table = { company: "companies", contact: "contacts", lead: "leads", deal: "deals" }[type] as "companies" | "contacts" | "leads" | "deals";
  let query = supabase.from(table).select("id,owner_id,status").eq("workspace_id", workspaceId).eq("id", id).is("archived_at", null);
  if (type === "deal") query = query.eq("status", "open");
  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data) && (canReassign || ((type === "company" || type === "contact") && data?.owner_id === userId));
}

async function isRelationOwnedBy(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, workspaceId: string, userId: string, type: string, id: string) {
  const table = { company: "companies", contact: "contacts", lead: "leads", deal: "deals" }[type] as "companies" | "contacts" | "leads" | "deals" | undefined;
  if (!table) return false;
  const { data, error } = await supabase.from(table).select("id").eq("workspace_id", workspaceId).eq("id", id).eq("owner_id", userId).is("archived_at", null).maybeSingle();
  return !error && Boolean(data);
}

function relationPath(type: string, id: string) {
  if (type === "company") return `/app/companies/${id}`;
  if (type === "contact") return `/app/contacts/${id}`;
  if (type === "deal") return `/app/deals/${id}`;
  return `/app/leads`;
}
