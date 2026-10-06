import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type NotificationType = "lead_assigned" | "deal_assigned" | "task_due" | "task_overdue" | "invite_accepted" | "deal_won" | "deal_lost";
export type Notification = {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_entity_type: "lead" | "deal" | null;
  related_entity_id: string | null;
  task_id: string | null;
  created_at: string;
  read_at: string | null;
  href: string | null;
};

export async function listNotifications(supabase: Supabase, workspaceId: string, recipientId: string): Promise<Notification[]> {
  const { data, error } = await supabase.from("notifications")
    .select("id,notification_type,title,message,related_entity_type,related_entity_id,task_id,created_at,read_at")
    .eq("workspace_id", workspaceId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load notifications.");
  return (data ?? []).map((notification) => ({
    ...notification,
    href: notification.related_entity_type && notification.related_entity_id
      ? `/app/${notification.related_entity_type === "lead" ? "leads" : "deals"}/${notification.related_entity_id}`
      : notification.task_id
        ? `/app/tasks?q=${encodeURIComponent(notification.message)}`
        : null,
  })) as Notification[];
}
