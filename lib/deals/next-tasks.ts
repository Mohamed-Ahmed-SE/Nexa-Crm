import { formatCalendarDate, type DateFormat } from "@/lib/preferences/date-format";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type DealNextTask = { title: string; due_at: string | null };
type RelatedTask = DealNextTask & { related_entity_id: string | null; status: string };

export function selectNextTasksByDeal(tasks: RelatedTask[]): Record<string, DealNextTask> {
  const selected = new Map<string, DealNextTask>();
  for (const task of tasks) {
    if (task.status !== "open" || !task.related_entity_id) continue;
    const current = selected.get(task.related_entity_id);
    if (!current || isEarlier(task.due_at, current.due_at)) {
      selected.set(task.related_entity_id, { title: task.title, due_at: task.due_at });
    }
  }
  return Object.fromEntries(selected);
}

export function formatNextTask(task: DealNextTask, dateFormat: DateFormat): string {
  return task.due_at ? `${task.title} · ${formatCalendarDate(task.due_at, dateFormat)}` : task.title;
}

export async function listNextTasksByDeal(supabase: Supabase, workspaceId: string, dealIds: string[]): Promise<Record<string, DealNextTask>> {
  if (!dealIds.length) return {};
  const { data, error } = await supabase.from("tasks").select("title,due_at,related_entity_id,status")
    .eq("workspace_id", workspaceId).eq("related_entity_type", "deal").eq("status", "open")
    .in("related_entity_id", dealIds).order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error("Unable to load next tasks for workspace deals.");
  return selectNextTasksByDeal((data ?? []) as RelatedTask[]);
}

function isEarlier(candidate: string | null, current: string | null): boolean {
  if (candidate === null) return false;
  return current === null || Date.parse(candidate) < Date.parse(current);
}
