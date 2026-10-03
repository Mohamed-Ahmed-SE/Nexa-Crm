import { ModulePage } from "@/components/ui/module-page";

export default function SettingsPage() {
  return (
    <ModulePage
      description="Workspace and account configuration."
      emptyDescription="Settings will become available when authentication and workspace configuration are implemented."
      emptyTitle="Settings are not configured"
      title="Settings"
    />
  );
}
