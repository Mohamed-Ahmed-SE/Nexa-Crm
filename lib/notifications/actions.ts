"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listNotifications } from "@/lib/notifications/repository";
import { taskDateBounds } from "@/lib/tasks/schema";
import { notificationIdSchema, timezoneOffsetSchema } from "@/lib/notifications/schema";

export type NotificationActionResult = { ok: true; notifications?: Awaited<ReturnType<typeof listNotifications>> } | { ok: false; message: string };

export async function loadNotificationsAction(timezoneOffset: number, tomorrowTimezoneOffset: number): Promise<NotificationActionResult> {
  const context = await requirePermission("crm.view");
  const offsets = timezoneOffsetSchema.safeParse({ timezoneOffset, tomorrowTimezoneOffset });
  if (!offsets.success) return { ok: false, message: "Unable to load notifications. Refresh and try again." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured." };

  const { start, tomorrow } = taskDateBounds(new Date(), offsets.data.timezoneOffset, offsets.data.tomorrowTimezoneOffset);
  const { error } = await supabase.rpc("generate_task_notifications", {
    target_workspace_id: context.workspaceId,
    today_start: start.toISOString(),
    tomorrow_start: tomorrow.toISOString(),
  });
  if (error) return { ok: false, message: "Unable to refresh task notifications." };
  try {
    return { ok: true, notifications: await listNotifications(supabase, context.workspaceId, context.userId) };
  } catch {
    return { ok: false, message: "Unable to load notifications." };
  }
}

export async function markNotificationReadAction(notificationId: string): Promise<NotificationActionResult> {
  const context = await requirePermission("crm.view");
  const parsedId = notificationIdSchema.safeParse(notificationId);
  if (!parsedId.success) return { ok: false, message: "This notification could not be identified." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured." };

  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("workspace_id", context.workspaceId)
    .eq("recipient_id", context.userId)
    .is("read_at", null);
  if (error) return { ok: false, message: "Unable to mark this notification as read." };
  revalidatePath("/app/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const context = await requirePermission("crm.view");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured." };

  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", context.workspaceId)
    .eq("recipient_id", context.userId)
    .is("read_at", null);
  if (error) return { ok: false, message: "Unable to mark notifications as read." };
  revalidatePath("/app/notifications");
  return { ok: true };
}
