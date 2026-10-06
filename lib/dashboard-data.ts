export type DealStage = "Discovery" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
export type DealStatus = "open" | "won" | "lost";
export type DateScope = "month" | "30days" | "quarter" | "all";
export type DealSort = "closeDate" | "amount" | "newest";

export type DealRecord = {
  id: string;
  title: string;
  contact: string;
  company: string;
  stage: DealStage;
  status: DealStatus;
  amount: number;
  owner: string;
  createdAt: string;
  expectedCloseDate: string;
  lastActivityAt: string | null;
  source: string;
  wonAt: string | null;
};

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Unqualified";
export type LeadRecord = { id: string; name: string; company: string; status: LeadStatus; source: string; owner: string; estimatedValue: number; createdAt: string };
export type ContactRecord = { id: string; name: string; company: string; jobTitle: string; email: string; phone: string };
export type CompanyRecord = { id: string; name: string; industry: string; owner: string; contactCount: number; openPipeline: number };
export type TaskRecord = { id: string; title: string; relatedTo: string; dueAt: string; owner: string; status: "open" | "completed" | "cancelled"; priority: "High" | "Medium" | "Low" };
export type ActivityRecord = { id: string; title: string; detail: string; occurredAt: string; kind: "meeting" | "call" | "email" | "won" | "note" | "stageChange" | "taskCompletion" };
export type DashboardRecords = { deals: DealRecord[]; leads: LeadRecord[]; contacts: ContactRecord[]; companies: CompanyRecord[]; tasks: TaskRecord[]; activities: ActivityRecord[] };

const daysFrom = (now: Date, days: number, hour = 12) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

type DemoContactSeed = [id: string, name: string, company: string, jobTitle: string, email: string, phone: string];
type DemoDealSeed = Omit<DealRecord, "createdAt" | "expectedCloseDate" | "lastActivityAt" | "wonAt"> & {
  createdDays: number;
  closeDays: number;
  activityDays: number | null;
};
type DemoLeadSeed = Omit<LeadRecord, "createdAt"> & { createdDays: number };
type DemoTaskSeed = Omit<TaskRecord, "dueAt"> & { dueDays: number; dueHour: number };

const demoContacts: DemoContactSeed[] = [
  ["c1", "Sarah Chen", "Luna Commerce", "VP of Product", "sarah.chen@lunacommerce.example.com", "+1-202-555-0101"],
  ["c2", "Elena Rivera", "Luna Commerce", "Head of Growth", "elena.rivera@lunacommerce.example.com", "+1-202-555-0102"],
  ["c3", "Marcus Bell", "Luna Commerce", "Product Operations Lead", "marcus.bell@lunacommerce.example.com", "+1-202-555-0103"],
  ["c4", "Omar Farouk", "Vertex Logistics", "Chief Operating Officer", "omar.farouk@vertexlogistics.example.com", "+1-202-555-0104"],
  ["c5", "Sofia Patel", "Vertex Logistics", "Director of Fleet", "sofia.patel@vertexlogistics.example.com", "+1-202-555-0105"],
  ["c6", "Alex Morgan", "Vertex Logistics", "Logistics Systems Manager", "alex.morgan@vertexlogistics.example.com", "+1-202-555-0106"],
  ["c7", "Nadia Salem", "Clinica One", "Chief Medical Officer", "nadia.salem@clinicaone.example.com", "+1-202-555-0107"],
  ["c8", "Yusuf Hassan", "Clinica One", "Director of Patient Experience", "yusuf.hassan@clinicaone.example.com", "+1-202-555-0108"],
  ["c9", "James Park", "BrightPath Learning", "Chief Technology Officer", "james.park@brightpath.example.com", "+1-202-555-0109"],
  ["c10", "Maya Roberts", "BrightPath Learning", "Learning Product Manager", "maya.roberts@brightpath.example.com", "+1-202-555-0110"],
  ["c11", "Amira Youssef", "Atlas Property Group", "Managing Director", "amira.youssef@atlasproperty.example.com", "+1-202-555-0111"],
  ["c12", "Ethan Cole", "Atlas Property Group", "Head of Research", "ethan.cole@atlasproperty.example.com", "+1-202-555-0112"],
  ["c13", "Leila Haddad", "Atlas Property Group", "Property Data Lead", "leila.haddad@atlasproperty.example.com", "+1-202-555-0113"],
  ["c14", "Liam Johnson", "Harbor Hotels", "Chief Executive Officer", "liam.johnson@harborhotels.example.com", "+1-202-555-0114"],
  ["c15", "Layla Nabil", "Harbor Hotels", "Guest Experience Director", "layla.nabil@harborhotels.example.com", "+1-202-555-0115"],
  ["c16", "Mina Khalil", "NovaStack", "Founder", "mina.khalil@novastack.example.com", "+1-202-555-0116"],
  ["c17", "Oliver Chen", "NovaStack", "VP of Engineering", "oliver.chen@novastack.example.com", "+1-202-555-0117"],
  ["c18", "Noah Wilson", "ForgeWorks Manufacturing", "Plant Director", "noah.wilson@forgeworks.example.com", "+1-202-555-0118"],
  ["c19", "Amal Farouk", "ForgeWorks Manufacturing", "Manufacturing Systems Lead", "amal.farouk@forgeworks.example.com", "+1-202-555-0119"],
  ["c20", "Eva Martin", "CloudSync", "Chief Product Officer", "eva.martin@cloudsync.example.com", "+1-202-555-0120"],
  ["c21", "Grace Kim", "CloudSync", "Data Platform Manager", "grace.kim@cloudsync.example.com", "+1-202-555-0121"],
  ["c22", "Daniel Kim", "Greenline Foods", "Operations Director", "daniel.kim@greenlinefoods.example.com", "+1-202-555-0122"],
  ["c23", "Isabel Torres", "Greenline Foods", "Supply Chain Manager", "isabel.torres@greenlinefoods.example.com", "+1-202-555-0123"],
  ["c24", "Priya Shah", "Cedar Consulting", "Managing Partner", "priya.shah@cedarconsulting.example.com", "+1-202-555-0124"],
  ["c25", "David Hassan", "Cedar Consulting", "Director of Client Services", "david.hassan@cedarconsulting.example.com", "+1-202-555-0125"],
  ["c26", "Thomas Wright", "Summit Tech", "Chief Information Officer", "thomas.wright@summittech.example.com", "+1-202-555-0126"],
  ["c27", "Rina Kapoor", "Summit Tech", "Digital Transformation Lead", "rina.kapoor@summittech.example.com", "+1-202-555-0127"],
];

const demoDealSeeds: DemoDealSeed[] = [
  { id: "d1", title: "Platform redesign", contact: "Sarah Chen", company: "Luna Commerce", stage: "Proposal", status: "open", amount: 130000, owner: "Maya Hassan", createdDays: -22, closeDays: 18, activityDays: -2, source: "Referral" },
  { id: "d2", title: "Fleet visibility rollout", contact: "Omar Farouk", company: "Vertex Logistics", stage: "Negotiation", status: "open", amount: 68000, owner: "Omar Nabil", createdDays: -41, closeDays: -4, activityDays: -16, source: "Website" },
  { id: "d3", title: "Patient portal discovery", contact: "Nadia Salem", company: "Clinica One", stage: "Discovery", status: "open", amount: 27500, owner: "Lina Kareem", createdDays: -9, closeDays: 32, activityDays: -3, source: "Event" },
  { id: "d4", title: "Learning platform build", contact: "James Park", company: "BrightPath Learning", stage: "Qualified", status: "open", amount: 54000, owner: "Maya Hassan", createdDays: -30, closeDays: 24, activityDays: -17, source: "LinkedIn" },
  { id: "d5", title: "Property data hub", contact: "Amira Youssef", company: "Atlas Property Group", stage: "Proposal", status: "open", amount: 81500, owner: "Omar Nabil", createdDays: -56, closeDays: -11, activityDays: -19, source: "Website" },
  { id: "d6", title: "Hotel booking refresh", contact: "Liam Johnson", company: "Harbor Hotels", stage: "Negotiation", status: "open", amount: 39000, owner: "Lina Kareem", createdDays: -16, closeDays: 15, activityDays: -1, source: "Referral" },
  { id: "d7", title: "Commerce analytics", contact: "Mina Khalil", company: "NovaStack", stage: "Qualified", status: "open", amount: 33000, owner: "Omar Nabil", createdDays: -6, closeDays: 38, activityDays: -2, source: "Outbound" },
  { id: "d8", title: "Manufacturing portal", contact: "Noah Wilson", company: "ForgeWorks Manufacturing", stage: "Discovery", status: "open", amount: 46500, owner: "Maya Hassan", createdDays: -72, closeDays: 9, activityDays: -20, source: "Website" },
  { id: "d9", title: "Customer data platform", contact: "Eva Martin", company: "CloudSync", stage: "Won", status: "won", amount: 72000, owner: "Omar Nabil", createdDays: -37, closeDays: -8, activityDays: -3, source: "Website" },
  { id: "d10", title: "Supply chain audit", contact: "Daniel Kim", company: "Greenline Foods", stage: "Won", status: "won", amount: 28500, owner: "Lina Kareem", createdDays: -20, closeDays: -2, activityDays: -1, source: "Referral" },
  { id: "d11", title: "Operations dashboard", contact: "Priya Shah", company: "Cedar Consulting", stage: "Lost", status: "lost", amount: 19000, owner: "Maya Hassan", createdDays: -49, closeDays: -9, activityDays: -31, source: "LinkedIn" },
  { id: "d12", title: "Member experience app", contact: "Thomas Wright", company: "Summit Tech", stage: "Won", status: "won", amount: 61000, owner: "Omar Nabil", createdDays: -12, closeDays: -6, activityDays: -5, source: "Event" },
  { id: "d13", title: "Checkout optimization", contact: "Elena Rivera", company: "Luna Commerce", stage: "Discovery", status: "open", amount: 52000, owner: "Lina Kareem", createdDays: -7, closeDays: 25, activityDays: -1, source: "Outbound" },
  { id: "d14", title: "Warehouse planning suite", contact: "Alex Morgan", company: "Vertex Logistics", stage: "Qualified", status: "open", amount: 63000, owner: "Omar Nabil", createdDays: -19, closeDays: 20, activityDays: -5, source: "Referral" },
  { id: "d15", title: "Clinical intake redesign", contact: "Yusuf Hassan", company: "Clinica One", stage: "Lost", status: "lost", amount: 24500, owner: "Lina Kareem", createdDays: -36, closeDays: -3, activityDays: -8, source: "LinkedIn" },
  { id: "d16", title: "Adaptive learning portal", contact: "Maya Roberts", company: "BrightPath Learning", stage: "Won", status: "won", amount: 84500, owner: "Maya Hassan", createdDays: -27, closeDays: -1, activityDays: -1, source: "Website" },
  { id: "d17", title: "Portfolio intelligence", contact: "Leila Haddad", company: "Atlas Property Group", stage: "Discovery", status: "open", amount: 96000, owner: "Omar Nabil", createdDays: -4, closeDays: 29, activityDays: -2, source: "Event" },
  { id: "d18", title: "Guest loyalty program", contact: "Layla Nabil", company: "Harbor Hotels", stage: "Qualified", status: "open", amount: 41500, owner: "Lina Kareem", createdDays: -14, closeDays: 22, activityDays: -6, source: "Outbound" },
  { id: "d19", title: "Subscription insights", contact: "Oliver Chen", company: "NovaStack", stage: "Proposal", status: "open", amount: 74500, owner: "Omar Nabil", createdDays: -11, closeDays: 12, activityDays: -2, source: "LinkedIn" },
  { id: "d20", title: "Factory operations portal", contact: "Amal Farouk", company: "ForgeWorks Manufacturing", stage: "Proposal", status: "open", amount: 58500, owner: "Maya Hassan", createdDays: -33, closeDays: 17, activityDays: -14, source: "Website" },
  { id: "d21", title: "Customer analytics rollout", contact: "Grace Kim", company: "CloudSync", stage: "Negotiation", status: "open", amount: 91000, owner: "Omar Nabil", createdDays: -8, closeDays: 10, activityDays: -1, source: "Referral" },
  { id: "d22", title: "Supplier portal modernization", contact: "Isabel Torres", company: "Greenline Foods", stage: "Negotiation", status: "open", amount: 47000, owner: "Lina Kareem", createdDays: -25, closeDays: 14, activityDays: -3, source: "Outbound" },
  { id: "d23", title: "Client onboarding workspace", contact: "David Hassan", company: "Cedar Consulting", stage: "Negotiation", status: "open", amount: 36000, owner: "Maya Hassan", createdDays: -17, closeDays: 27, activityDays: -4, source: "Event" },
  { id: "d24", title: "Summit integration program", contact: "Rina Kapoor", company: "Summit Tech", stage: "Lost", status: "lost", amount: 55000, owner: "Omar Nabil", createdDays: -45, closeDays: -13, activityDays: null, source: "LinkedIn" },
];

const demoLeadSeeds: DemoLeadSeed[] = [
  { id: "l1", name: "Aiden Brooks", company: "Luna Commerce", status: "New", source: "Website", owner: "Maya Hassan", estimatedValue: 18000, createdDays: -1 },
  { id: "l2", name: "Sofia Patel", company: "Vertex Logistics", status: "Contacted", source: "Referral", owner: "Omar Nabil", estimatedValue: 24000, createdDays: -3 },
  { id: "l3", name: "Yusuf Hassan", company: "Clinica One", status: "Qualified", source: "LinkedIn", owner: "Lina Kareem", estimatedValue: 32000, createdDays: -5 },
  { id: "l4", name: "Maya Roberts", company: "BrightPath Learning", status: "New", source: "Event", owner: "Maya Hassan", estimatedValue: 21000, createdDays: -8 },
  { id: "l5", name: "Ethan Cole", company: "Atlas Property Group", status: "Contacted", source: "Outbound", owner: "Omar Nabil", estimatedValue: 16000, createdDays: -11 },
  { id: "l6", name: "Layla Nabil", company: "Harbor Hotels", status: "Qualified", source: "Website", owner: "Lina Kareem", estimatedValue: 28000, createdDays: -18 },
  { id: "l7", name: "Oliver Chen", company: "NovaStack", status: "New", source: "Referral", owner: "Omar Nabil", estimatedValue: 12000, createdDays: -25 },
  { id: "l8", name: "Amal Farouk", company: "ForgeWorks Manufacturing", status: "Contacted", source: "LinkedIn", owner: "Maya Hassan", estimatedValue: 35000, createdDays: -44 },
  { id: "l9", name: "Grace Kim", company: "CloudSync", status: "New", source: "Outbound", owner: "Omar Nabil", estimatedValue: 41000, createdDays: -2 },
  { id: "l10", name: "Isabel Torres", company: "Greenline Foods", status: "Qualified", source: "Event", owner: "Lina Kareem", estimatedValue: 27000, createdDays: -13 },
  { id: "l11", name: "David Hassan", company: "Cedar Consulting", status: "New", source: "Website", owner: "Maya Hassan", estimatedValue: 52000, createdDays: -4 },
  { id: "l12", name: "Rina Kapoor", company: "Summit Tech", status: "Contacted", source: "Referral", owner: "Omar Nabil", estimatedValue: 46000, createdDays: -7 },
  { id: "l13", name: "Nora Ibrahim", company: "Luna Commerce", status: "Qualified", source: "LinkedIn", owner: "Lina Kareem", estimatedValue: 22000, createdDays: -16 },
  { id: "l14", name: "Marcus Lee", company: "Vertex Logistics", status: "New", source: "Outbound", owner: "Omar Nabil", estimatedValue: 31000, createdDays: -6 },
  { id: "l15", name: "Hana Saleh", company: "Clinica One", status: "Contacted", source: "Event", owner: "Lina Kareem", estimatedValue: 19500, createdDays: -15 },
  { id: "l16", name: "Peter Novak", company: "BrightPath Learning", status: "Qualified", source: "Website", owner: "Maya Hassan", estimatedValue: 38500, createdDays: -24 },
  { id: "l17", name: "Mariam Adel", company: "Atlas Property Group", status: "New", source: "Referral", owner: "Omar Nabil", estimatedValue: 29500, createdDays: -10 },
  { id: "l18", name: "Theo Grant", company: "Harbor Hotels", status: "Unqualified", source: "LinkedIn", owner: "Lina Kareem", estimatedValue: 17500, createdDays: -35 },
  { id: "l19", name: "Zara Mahmoud", company: "NovaStack", status: "Unqualified", source: "Outbound", owner: "Omar Nabil", estimatedValue: 14500, createdDays: -18 },
  { id: "l20", name: "Caleb Foster", company: "ForgeWorks Manufacturing", status: "Unqualified", source: "Event", owner: "Maya Hassan", estimatedValue: 26000, createdDays: -28 },
];

const demoTaskSeeds: DemoTaskSeed[] = [
  { id: "t1", title: "Send revised scope", relatedTo: "Luna Commerce", dueDays: -2, dueHour: 9, owner: "Maya Hassan", status: "open", priority: "High" },
  { id: "t2", title: "Follow up on fleet demo", relatedTo: "Vertex Logistics", dueDays: -1, dueHour: 9, owner: "Omar Nabil", status: "open", priority: "High" },
  { id: "t3", title: "Review patient portal notes", relatedTo: "Clinica One", dueDays: -4, dueHour: 9, owner: "Lina Kareem", status: "open", priority: "Medium" },
  { id: "t4", title: "Confirm analytics handoff", relatedTo: "NovaStack", dueDays: -3, dueHour: 9, owner: "Omar Nabil", status: "open", priority: "High" },
  { id: "t5", title: "Send property data outline", relatedTo: "Atlas Property Group", dueDays: -5, dueHour: 9, owner: "Maya Hassan", status: "open", priority: "Medium" },
  { id: "t6", title: "Prepare discovery agenda", relatedTo: "Clinica One", dueDays: 0, dueHour: 16, owner: "Lina Kareem", status: "open", priority: "Medium" },
  { id: "t7", title: "Confirm proposal review", relatedTo: "Harbor Hotels", dueDays: 0, dueHour: 16, owner: "Lina Kareem", status: "open", priority: "High" },
  { id: "t8", title: "Send platform walkthrough", relatedTo: "BrightPath Learning", dueDays: 0, dueHour: 16, owner: "Maya Hassan", status: "open", priority: "Medium" },
  { id: "t9", title: "Share updated forecast", relatedTo: "CloudSync", dueDays: 0, dueHour: 16, owner: "Omar Nabil", status: "open", priority: "Low" },
  { id: "t10", title: "Confirm supplier workshop", relatedTo: "Greenline Foods", dueDays: 0, dueHour: 16, owner: "Lina Kareem", status: "open", priority: "High" },
  { id: "t11", title: "Send introduction", relatedTo: "Atlas Property Group", dueDays: 1, dueHour: 16, owner: "Maya Hassan", status: "open", priority: "Medium" },
  { id: "t12", title: "Schedule operations review", relatedTo: "Cedar Consulting", dueDays: 1, dueHour: 16, owner: "Maya Hassan", status: "open", priority: "Low" },
  { id: "t13", title: "Share case study", relatedTo: "NovaStack", dueDays: 1, dueHour: 16, owner: "Omar Nabil", status: "open", priority: "Low" },
  { id: "t14", title: "Review guest journey", relatedTo: "Harbor Hotels", dueDays: 1, dueHour: 16, owner: "Lina Kareem", status: "open", priority: "Medium" },
  { id: "t15", title: "Prepare integration plan", relatedTo: "Luna Commerce", dueDays: 1, dueHour: 16, owner: "Omar Nabil", status: "open", priority: "High" },
  { id: "t16", title: "Draft implementation timeline", relatedTo: "Vertex Logistics", dueDays: 7, dueHour: 16, owner: "Omar Nabil", status: "open", priority: "Medium" },
  { id: "t17", title: "Review product requirements", relatedTo: "Luna Commerce", dueDays: 8, dueHour: 16, owner: "Maya Hassan", status: "open", priority: "Low" },
  { id: "t18", title: "Prepare manufacturing demo", relatedTo: "ForgeWorks Manufacturing", dueDays: 9, dueHour: 16, owner: "Maya Hassan", status: "open", priority: "High" },
  { id: "t19", title: "Confirm data migration scope", relatedTo: "CloudSync", dueDays: 10, dueHour: 16, owner: "Omar Nabil", status: "open", priority: "Medium" },
  { id: "t20", title: "Share onboarding options", relatedTo: "Atlas Property Group", dueDays: 11, dueHour: 16, owner: "Lina Kareem", status: "open", priority: "Low" },
  { id: "t21", title: "Log discovery outcomes", relatedTo: "Clinica One", dueDays: -3, dueHour: 10, owner: "Lina Kareem", status: "completed", priority: "Low" },
  { id: "t22", title: "Send contract summary", relatedTo: "Greenline Foods", dueDays: -6, dueHour: 10, owner: "Lina Kareem", status: "completed", priority: "Medium" },
  { id: "t23", title: "Complete account brief", relatedTo: "BrightPath Learning", dueDays: -1, dueHour: 10, owner: "Maya Hassan", status: "completed", priority: "Low" },
  { id: "t24", title: "Record stakeholder notes", relatedTo: "Cedar Consulting", dueDays: -8, dueHour: 10, owner: "Maya Hassan", status: "completed", priority: "Medium" },
  { id: "t25", title: "Close follow-up loop", relatedTo: "Harbor Hotels", dueDays: -4, dueHour: 10, owner: "Lina Kareem", status: "completed", priority: "High" },
];

const demoIndustries: Record<string, string> = {
  "Luna Commerce": "Ecommerce", "Vertex Logistics": "Logistics", "Clinica One": "Healthcare",
  "BrightPath Learning": "Education", "Atlas Property Group": "Real Estate", "Harbor Hotels": "Hospitality",
  NovaStack: "SaaS", "ForgeWorks Manufacturing": "Manufacturing", CloudSync: "SaaS",
  "Greenline Foods": "Food & beverage", "Cedar Consulting": "Professional services", "Summit Tech": "SaaS",
};

function createDemoDeals(now: Date): DealRecord[] {
  return demoDealSeeds.map(({ createdDays, closeDays, activityDays, ...deal }) => ({
    ...deal,
    createdAt: daysFrom(now, createdDays),
    expectedCloseDate: daysFrom(now, closeDays).slice(0, 10),
    lastActivityAt: activityDays === null ? null : daysFrom(now, activityDays),
    wonAt: deal.status === "won" ? daysFrom(now, closeDays) : null,
  }));
}

function createDemoLeads(now: Date): LeadRecord[] {
  return demoLeadSeeds.map(({ createdDays, ...lead }) => ({ ...lead, createdAt: daysFrom(now, createdDays) }));
}

function createDemoTasks(now: Date): TaskRecord[] {
  return demoTaskSeeds.map(({ dueDays, dueHour, ...task }) => ({ ...task, dueAt: daysFrom(now, dueDays, dueHour) }));
}

const highValueActivityEvents: { kind: ActivityRecord["kind"]; title: string }[] = [
  { kind: "meeting", title: "Discovery meeting held" },
  { kind: "note", title: "Deal notes updated" },
  { kind: "stageChange", title: "Deal stage changed" },
  { kind: "taskCompletion", title: "Follow-up task completed" },
];

function createHighValueDealActivities(deals: DealRecord[], now: Date): ActivityRecord[] {
  return [...deals]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 4)
    .flatMap((deal, dealIndex) => highValueActivityEvents.map(({ kind, title }, eventIndex) => ({
      id: `activity-${deal.id}-${kind}`,
      title,
      detail: `${deal.title} · ${deal.company}`,
      occurredAt: daysFrom(now, -(dealIndex * highValueActivityEvents.length + eventIndex + 1)),
      kind,
    })));
}

function createDemoCompanies(deals: DealRecord[], contacts: ContactRecord[]): CompanyRecord[] {
  return [...new Set(deals.map((deal) => deal.company))].map((name, index) => {
    const companyDeals = deals.filter((deal) => deal.company === name);
    return {
      id: `c${index + 1}`,
      name,
      industry: demoIndustries[name],
      owner: companyDeals[0].owner,
      contactCount: contacts.filter((contact) => contact.company === name).length,
      openPipeline: companyDeals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.amount, 0),
    };
  });
}

export function createDemoRecords(now: Date = new Date()): DashboardRecords {
  const contacts = demoContacts.map(([id, name, company, jobTitle, email, phone]) => ({ id, name, company, jobTitle, email, phone }));
  const deals = createDemoDeals(now);
  const leads = createDemoLeads(now);
  const companies = createDemoCompanies(deals, contacts);
  const tasks = createDemoTasks(now);
  const baseActivities: ActivityRecord[] = [
    ["a1", "Proposal shared", "Maya Hassan · Luna Commerce", -1, "email"],
    ["a2", "Discovery call completed", "Lina Kareem · Clinica One", -1, "call"],
    ["a3", "Deal marked won", "Omar Nabil · CloudSync", -2, "won"],
    ["a4", "Scope review scheduled", "Omar Nabil · Vertex Logistics", -3, "meeting"],
  ].map(([id, title, detail, occurred, kind]) => ({ id: String(id), title: String(title), detail: String(detail), occurredAt: daysFrom(now, Number(occurred)), kind: String(kind) as ActivityRecord["kind"] }));
  const activities = [...baseActivities, ...createHighValueDealActivities(deals, now)]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  return { deals, leads, contacts, companies, tasks, activities };
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function isInDateScope(dateValue: string, scope: DateScope, now: Date): boolean {
  if (scope === "all") return true;
  const eventDate = new Date(dateValue);
  if (scope === "30days") return eventDate >= new Date(now.getTime() - 30 * 86400000) && eventDate <= now;
  const periodStart = scope === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return eventDate >= periodStart && eventDate <= now;
}

export function isTaskOverdue(task: TaskRecord, now: Date): boolean {
  return task.status === "open" && new Date(task.dueAt) < now;
}

export function getAttentionReasons(deal: DealRecord, tasks: TaskRecord[], now: Date): string[] {
  if (deal.status !== "open") return [];
  const reasons: string[] = [];
  if (deal.expectedCloseDate < startOfDay(now).toISOString().slice(0, 10)) reasons.push("Past expected close");
  const hasFutureTask = tasks.some((task) => task.status === "open" && task.relatedTo === deal.company && new Date(task.dueAt) > now);
  if (!hasFutureTask) reasons.push("No upcoming task");
  const lastTouch = deal.lastActivityAt ? new Date(deal.lastActivityAt) : new Date(deal.createdAt);
  if (now.getTime() - lastTouch.getTime() >= 14 * 86400000 && now.getTime() - new Date(deal.createdAt).getTime() >= 14 * 86400000) reasons.push("No activity in 14+ days");
  return reasons;
}

export function selectDashboard(records: DashboardRecords, scope: DateScope, now: Date) {
  const openDeals = records.deals.filter((deal) => deal.status === "open");
  const scopedDeals = records.deals.filter((deal) => isInDateScope(deal.createdAt, scope, now));
  const closedInScope = records.deals.filter((deal) => deal.wonAt && isInDateScope(deal.wonAt, scope, now));
  const scopedLeads = records.leads.filter((lead) => isInDateScope(lead.createdAt, scope, now));
  const overdueTasks = records.tasks.filter((task) => isTaskOverdue(task, now));
  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = todayStart + 86400000;
  const dueToday = records.tasks.filter((task) => task.status === "open" && new Date(task.dueAt).getTime() >= todayStart && new Date(task.dueAt).getTime() < tomorrowStart);
  const attentionDeals = openDeals.map((deal) => ({ deal, reasons: getAttentionReasons(deal, records.tasks, now) })).filter(({ reasons }) => reasons.length > 0);
  const stageTotals = (["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as DealStage[]).map((stage) => {
    const stageDeals = scopedDeals.filter((deal) => deal.stage === stage);
    return { stage, count: stageDeals.length, amount: stageDeals.reduce((sum, deal) => sum + deal.amount, 0) };
  });
  const sourceTotals = [...new Set(scopedDeals.map((deal) => deal.source))].map((source) => ({
    source,
    count: scopedDeals.filter((deal) => deal.source === source).length,
  })).sort((left, right) => right.count - left.count);
  return {
    pipelineValue: openDeals.reduce((sum, deal) => sum + deal.amount, 0),
    openDealCount: openDeals.length,
    newLeadCount: scopedLeads.length,
    wonRevenue: closedInScope.reduce((sum, deal) => sum + deal.amount, 0),
    overdueTaskCount: overdueTasks.length,
    dueToday,
    overdueTasks,
    scopedDeals,
    scopedLeads,
    stageTotals,
    sourceTotals,
    activities: records.activities.filter((activity) => isInDateScope(activity.occurredAt, scope, now)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    attentionDeals,
  };
}

export function selectVisibleDeals(deals: DealRecord[], query: string, filter: "all" | "attention", sort: DealSort, tasks: TaskRecord[], now: Date): DealRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  return deals.filter((deal) => {
    const matchesQuery = `${deal.title} ${deal.contact} ${deal.company} ${deal.owner}`.toLowerCase().includes(normalizedQuery);
    const matchesFilter = filter === "all" || getAttentionReasons(deal, tasks, now).length > 0;
    return matchesQuery && matchesFilter;
  }).sort((left, right) => {
    if (sort === "amount") return right.amount - left.amount;
    if (sort === "newest") return right.createdAt.localeCompare(left.createdAt);
    return left.expectedCloseDate.localeCompare(right.expectedCloseDate);
  });
}

function sumDealAmounts(deals: DealRecord[]): number {
  return deals.reduce((sum, deal) => sum + deal.amount, 0);
}

function summarizeDealStages(deals: DealRecord[]) {
  const stages = ["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
  return stages.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    return { stage, count: stageDeals.length, amount: sumDealAmounts(stageDeals) };
  });
}

function summarizeDealSources(deals: DealRecord[]) {
  return [...new Set(deals.map((deal) => deal.source))].map((source) => ({
    source,
    count: deals.filter((deal) => deal.source === source).length,
  })).sort((left, right) => right.count - left.count);
}

function summarizeDealOwners(deals: DealRecord[]) {
  return [...new Set(deals.map((deal) => deal.owner))].map((owner) => {
    const ownerDeals = deals.filter((deal) => deal.owner === owner);
    return {
      owner,
      count: ownerDeals.length,
      wonRevenue: sumDealAmounts(ownerDeals.filter((deal) => deal.status === "won")),
      pipeline: sumDealAmounts(ownerDeals.filter((deal) => deal.status === "open")),
    };
  }).sort((left, right) => right.pipeline - left.pipeline);
}

export function selectDemoReports(records: DashboardRecords) {
  const wonDeals = records.deals.filter((deal) => deal.status === "won");
  const closedDealCount = wonDeals.length + records.deals.filter((deal) => deal.status === "lost").length;
  const dealValue = sumDealAmounts(records.deals);

  return {
    totalDeals: records.deals.length,
    wonRevenue: sumDealAmounts(wonDeals),
    winRate: closedDealCount ? wonDeals.length / closedDealCount : 0,
    averageDealValue: records.deals.length ? dealValue / records.deals.length : 0,
    openPipeline: sumDealAmounts(records.deals.filter((deal) => deal.status === "open")),
    stageTotals: summarizeDealStages(records.deals),
    sourceTotals: summarizeDealSources(records.deals),
    ownerTotals: summarizeDealOwners(records.deals),
    topDeals: [...records.deals].sort((left, right) => right.amount - left.amount).slice(0, 5),
    completedTasks: records.tasks.filter((task) => task.status === "completed").length,
    totalContacts: records.contacts.length,
    totalLeads: records.leads.length,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}
