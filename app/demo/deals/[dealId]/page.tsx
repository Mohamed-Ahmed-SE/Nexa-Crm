import { notFound } from "next/navigation";
import { DemoDealDetail } from "@/components/demo/demo-deal-detail";
import { createDemoRecords } from "@/lib/dashboard-data";

type DemoDealDetailPageProps = {
  params: Promise<{ dealId: string }>;
};

export default async function DemoDealDetailPage({ params }: DemoDealDetailPageProps) {
  const { dealId } = await params;
  const records = createDemoRecords();
  const deal = records.deals.find((record) => record.id === dealId);
  if (!deal) notFound();

  const contact = records.contacts.find((record) => record.name === deal.contact);
  const dealReference = `${deal.title} · ${deal.company}`;
  const activities = records.activities.filter((activity) => activity.detail.includes(dealReference));
  const companyTasks = records.tasks.filter((task) => task.relatedTo === deal.company);

  return <DemoDealDetail activities={activities} companyTasks={companyTasks} contact={contact} deal={deal} />;
}
