import type { createSupabaseServerClient } from "@/lib/supabase/server";

const staleAfterMs = 14 * 86_400_000;

type AttentionDeal = { id: string; status: "open" | "won" | "lost"; expectedCloseDate: string | null; createdAt: string };
type AttentionTask = { relatedId: string | null; dueAt: string | null; status: string };
export type DealAttentionReason = "overdue-close" | "stale-activity" | "no-future-task";
export type DealAttentionReasons = Record<string, DealAttentionReason[]>;
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export function getDealAttentionReasons(options: {
  deal: AttentionDeal;
  tasks: AttentionTask[];
  latestActivityAt: string | null;
  today: string;
  now: Date;
}): DealAttentionReason[] {
  const { deal, tasks, latestActivityAt, today, now } = options;
  if (deal.status !== "open") return [];
  const reasons: DealAttentionReason[] = [];
  if (deal.expectedCloseDate && deal.expectedCloseDate < today) reasons.push("overdue-close");
  const lastContactAt = latestActivityAt ?? deal.createdAt;
  if (now.valueOf() - Date.parse(lastContactAt) >= staleAfterMs) reasons.push("stale-activity");
  if (!tasks.some((task) => task.relatedId === deal.id && task.status === "open" && task.dueAt !== null && Date.parse(task.dueAt) > now.valueOf())) {
    reasons.push("no-future-task");
  }
  return reasons;
}

export async function listDealAttentionReasons(options: {
  supabase: Supabase;
  workspaceId: string;
  deals: Array<AttentionDeal>;
  today: string;
  now: Date;
}): Promise<DealAttentionReasons> {
  const { supabase, workspaceId, deals, today, now } = options;
  if (!deals.length) return {};
  const dealIds = deals.map(({ id }) => id);
  const since = new Date(now.valueOf() - staleAfterMs).toISOString();
  const [tasksResult, activitiesResult] = await Promise.all([
    supabase.from("tasks").select("related_entity_id,due_at,status").eq("workspace_id", workspaceId)
      .eq("related_entity_type", "deal").in("related_entity_id", dealIds).eq("status", "open").gt("due_at", now.toISOString()),
    supabase.from("activities").select("related_entity_id,occurred_at").eq("workspace_id", workspaceId)
      .eq("related_entity_type", "deal").in("related_entity_id", dealIds).gte("occurred_at", since)
      .lte("occurred_at", now.toISOString()).order("occurred_at", { ascending: false }),
  ]);
  if (tasksResult.error || activitiesResult.error) throw new Error("Unable to load deal attention details.");
  const tasks = ((tasksResult.data ?? []) as Array<{ related_entity_id: string | null; due_at: string | null; status: string }>).map(({ related_entity_id, due_at, status }) => ({ relatedId: related_entity_id, dueAt: due_at, status }));
  const latestActivities = new Map<string, string>();
  for (const activity of (activitiesResult.data ?? []) as Array<{ related_entity_id: string | null; occurred_at: string }>) {
    if (activity.related_entity_id && !latestActivities.has(activity.related_entity_id)) latestActivities.set(activity.related_entity_id, activity.occurred_at);
  }
  return Object.fromEntries(deals.map((deal) => [deal.id, getDealAttentionReasons({ deal, tasks, latestActivityAt: latestActivities.get(deal.id) ?? null, today, now })]));
}
