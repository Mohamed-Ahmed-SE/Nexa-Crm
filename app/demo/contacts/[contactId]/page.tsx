import { notFound } from "next/navigation";
import { DemoContactDetail } from "@/components/demo/demo-contacts";
import { createDemoRecords } from "@/lib/dashboard-data";

type DemoContactDetailPageProps = {
  params: Promise<{ contactId: string }>;
};

export default async function DemoContactDetailPage({ params }: DemoContactDetailPageProps) {
  const { contactId } = await params;
  const records = createDemoRecords();
  const contact = records.contacts.find((record) => record.id === contactId);
  if (!contact) notFound();

  const company = records.companies.find((record) => record.name === contact.company);
  const deals = records.deals.filter((record) => record.contact === contact.name);
  const companyTasks = records.tasks.filter((record) => record.relatedTo === contact.company);

  return <DemoContactDetail company={company} companyTasks={companyTasks} contact={contact} deals={deals} />;
}
