import { ModulePage } from "@/components/ui/module-page";

export default function DashboardPage() {
  return (
    <ModulePage
      description="Your sales workspace overview will live here."
      emptyDescription="Authentication and workspace data are not connected in this foundation build, so there are no records or metrics to display."
      emptyTitle="Your workspace is not connected yet"
      title="Dashboard"
    />
  );
}
