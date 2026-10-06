import { DemoContactsDirectory } from "@/components/demo/demo-contacts";
import { createDemoRecords } from "@/lib/dashboard-data";

export default function DemoContactsPage() {
  const { contacts } = createDemoRecords();
  return <DemoContactsDirectory contacts={contacts} />;
}
