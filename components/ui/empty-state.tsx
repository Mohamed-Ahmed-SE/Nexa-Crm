import { Database } from "lucide-react";

export type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section aria-labelledby="empty-state-title" className="empty-state">
      <span aria-hidden="true" className="empty-state-icon">
        <Database size={20} strokeWidth={1.8} />
      </span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
    </section>
  );
}
