import { notFound } from "next/navigation";
import { DemoCompanyDetail } from "@/components/demo/demo-company-detail";
import { createDemoRecords } from "@/lib/dashboard-data";

type DemoCompanyDetailPageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DemoCompanyDetailPage({ params }: DemoCompanyDetailPageProps) {
  const { companyId } = await params;
  const now = new Date();
  const records = createDemoRecords(now);
  const company = records.companies.find((record) => record.id === companyId);
  if (!company) notFound();

  return <DemoCompanyDetail company={company} now={now} records={records} />;
}
