import { requirePermission } from "@/lib/auth/authorize";
import { NotificationsWorkspace } from "./notifications-workspace";

export default async function NotificationsPage() {
  await requirePermission("crm.view");
  return <NotificationsWorkspace />;
}
