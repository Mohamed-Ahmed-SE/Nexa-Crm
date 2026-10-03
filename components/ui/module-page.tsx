import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type ModulePageProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function ModulePage({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: ModulePageProps) {
  return (
    <div className="page-container">
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
