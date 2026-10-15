import type { WorkspaceRole } from "@/lib/auth/permissions";
import { canModifyManualActivity, isManualActivityType } from "./manual";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

export type ActivityEntityType = "contact" | "company" | "deal" | "lead";
export type ActivityTarget = { workspaceId: string; entityType: ActivityEntityType; entityId: string; activityId: string };
export type ActivityValues = { type: string; subject: string; body: string | null; occurredAt: string };
export type ActivityVerb = "update" | "delete";

/**
 * Looks the activity up by workspace, entity and id, then checks that the caller may modify it.
 * Returns a user-facing message when modification is not allowed, otherwise null. The database
 * policies and guard trigger enforce the same rule independently.
 */
export async function activityModificationError(
  supabase: Supabase,
  { target, role, userId, verb, entityLabel }: { target: ActivityTarget; role: WorkspaceRole; userId: string; verb: ActivityVerb; entityLabel: string },
): Promise<string | null> {
  const { data: activity, error } = await supabase.from("activities").select("id, created_by, is_system_event, activity_type")
    .eq("workspace_id", target.workspaceId).eq("related_entity_type", target.entityType)
    .eq("related_entity_id", target.entityId).eq("id", target.activityId).maybeSingle();
  if (error || !activity) return `Activity could not be ${verb}d. Refresh the ${entityLabel} and try again.`;
  if (activity.is_system_event || !isManualActivityType(activity.activity_type)) return "System-generated activities cannot be changed.";
  if (!canModifyManualActivity({ isAdmin: role === "admin", userId, activity })) return `You can ${verb} only activities you created.`;
  return null;
}

export async function updateManualActivity(supabase: Supabase, target: ActivityTarget, values: ActivityValues): Promise<boolean> {
  const { data, error } = await supabase.from("activities")
    .update({ activity_type: values.type, subject: values.subject, body: values.body, occurred_at: values.occurredAt })
    .eq("workspace_id", target.workspaceId).eq("related_entity_type", target.entityType)
    .eq("related_entity_id", target.entityId).eq("id", target.activityId).select("id").maybeSingle();
  return !error && Boolean(data);
}

export async function deleteManualActivity(supabase: Supabase, target: ActivityTarget): Promise<boolean> {
  const { data, error } = await supabase.from("activities").delete()
    .eq("workspace_id", target.workspaceId).eq("related_entity_type", target.entityType)
    .eq("related_entity_id", target.entityId).eq("id", target.activityId).select("id").maybeSingle();
  return !error && Boolean(data);
}
