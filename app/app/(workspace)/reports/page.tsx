import { ModulePage } from "@/components/ui/module-page";

export default function ReportsPage() {
  return (
    <ModulePage
      description="Review sales performance when workspace data is available."
      emptyDescription="Reports are not available until the CRM has data to query. No sample figures are shown."
      emptyTitle="No report data yet"
      title="Reports"
    />
  );
}
