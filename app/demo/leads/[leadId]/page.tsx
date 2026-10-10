import { notFound } from "next/navigation";
import { DemoLeadDetail } from "@/components/demo/demo-lead-detail";
import { createDemoRecords } from "@/lib/dashboard-data";

type DemoLeadDetailPageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function DemoLeadDetailPage({ params }: DemoLeadDetailPageProps) {
  const { leadId } = await params;
  const records = createDemoRecords();
  const lead = records.leads.find((record) => record.id === leadId);
  if (!lead) notFound();

  const company = records.companies.find((record) => record.name === lead.company);
  const companyTasks = records.tasks.filter((task) => task.relatedTo === lead.company);

  return <DemoLeadDetail company={company} companyTasks={companyTasks} lead={lead} />;
}
