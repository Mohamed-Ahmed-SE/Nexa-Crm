import { ModulePage } from "@/components/ui/module-page";

export default function NotificationsPage() {
  return (
    <ModulePage
      description="Review updates related to your workspace."
      emptyDescription="Notifications will appear here after accounts and workspace activity are connected."
      emptyTitle="Notifications are not connected"
      title="Notifications"
    />
  );
}
