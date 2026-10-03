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

export type LeadRecord = { id: string; name: string; source: string; createdAt: string };
export type TaskRecord = { id: string; title: string; relatedTo: string; dueAt: string; status: "open" | "completed" | "cancelled"; priority: "High" | "Medium" | "Low" };
export type ActivityRecord = { id: string; title: string; detail: string; occurredAt: string; kind: "meeting" | "call" | "email" | "won" };
export type DashboardRecords = { deals: DealRecord[]; leads: LeadRecord[]; tasks: TaskRecord[]; activities: ActivityRecord[] };

const daysFrom = (now: Date, days: number, hour = 12) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export function createDemoRecords(now: Date = new Date()): DashboardRecords {
  const deals: DealRecord[] = [
    ["d1", "Platform redesign", "Sarah Chen", "Luna Commerce", "Proposal", "open", 42000, "Maya Hassan", -22, 18, -2, "Referral"],
    ["d2", "Fleet visibility rollout", "Omar Farouk", "Vertex Logistics", "Negotiation", "open", 68000, "Omar Nabil", -41, -4, -16, "Website"],
    ["d3", "Patient portal discovery", "Nadia Salem", "Clinica One", "Discovery", "open", 27500, "Lina Kareem", -9, 32, -3, "Event"],
    ["d4", "Learning platform build", "James Park", "BrightPath Learning", "Qualified", "open", 54000, "Maya Hassan", -30, 24, -17, "LinkedIn"],
    ["d5", "Property data hub", "Amira Youssef", "Atlas Property Group", "Proposal", "open", 81500, "Omar Nabil", -56, -11, -19, "Partner"],
    ["d6", "Hotel booking refresh", "Liam Johnson", "Harbor Hotels", "Negotiation", "open", 39000, "Lina Kareem", -16, 15, -1, "Referral"],
    ["d7", "Commerce analytics", "Mina Khalil", "NovaStack", "Qualified", "open", 33000, "Omar Nabil", -6, 38, -2, "Outbound"],
    ["d8", "Manufacturing portal", "Noah Wilson", "ForgeWorks Manufacturing", "Discovery", "open", 46500, "Maya Hassan", -72, 9, -20, "Website"],
    ["d9", "Customer data platform", "Eva Martin", "CloudSync", "Won", "won", 72000, "Omar Nabil", -37, -8, -3, "Website"],
    ["d10", "Supply chain audit", "Daniel Kim", "Greenline Foods", "Won", "won", 28500, "Lina Kareem", -20, -2, -1, "Referral"],
    ["d11", "Operations dashboard", "Priya Shah", "Cedar Consulting", "Lost", "lost", 19000, "Maya Hassan", -49, -9, -31, "LinkedIn"],
    ["d12", "Member experience app", "Thomas Wright", "Summit Tech", "Won", "won", 61000, "Omar Nabil", -12, -6, -5, "Event"],
  ].map(([id, title, contact, company, stage, status, amount, owner, created, close, activity, source]) => {
    const key = String(id);
    const dealStatus = String(status) as DealStatus;
    const activityDays = Number(activity);
    return {
      id: key,
      title: String(title),
      contact: String(contact),
      company: String(company),
      stage: String(stage) as DealStage,
      status: dealStatus,
      amount: Number(amount),
      owner: String(owner),
      createdAt: daysFrom(now, Number(created)),
      expectedCloseDate: daysFrom(now, Number(close)).slice(0, 10),
      lastActivityAt: activityDays === -99 ? null : daysFrom(now, activityDays),
      source: String(source),
      wonAt: dealStatus === "won" ? daysFrom(now, Number(close)) : null,
    };
  });
  const leads: LeadRecord[] = [
    ["l1", "Aiden Brooks", "Website", -1], ["l2", "Sofia Patel", "Referral", -3],
    ["l3", "Yusuf Hassan", "LinkedIn", -5], ["l4", "Maya Roberts", "Event", -8],
    ["l5", "Ethan Cole", "Outbound", -11], ["l6", "Layla Nabil", "Website", -18],
    ["l7", "Oliver Chen", "Referral", -25], ["l8", "Amal Farouk", "LinkedIn", -44],
  ].map(([id, name, source, created]) => ({ id: String(id), name: String(name), source: String(source), createdAt: daysFrom(now, Number(created)) }));
  const tasks: TaskRecord[] = [
    ["t1", "Send revised scope", "Luna Commerce", -2, "open", "High"],
    ["t2", "Prepare discovery agenda", "Clinica One", 0, "open", "Medium"],
    ["t3", "Confirm proposal review", "Harbor Hotels", 0, "open", "High"],
    ["t4", "Share case study", "NovaStack", 1, "open", "Low"],
    ["t5", "Follow up on fleet demo", "Vertex Logistics", -1, "open", "High"],
    ["t6", "Send introduction", "Atlas Property Group", 0, "completed", "Medium"],
  ].map(([id, title, relatedTo, due, status, priority]) => ({ id: String(id), title: String(title), relatedTo: String(relatedTo), dueAt: daysFrom(now, Number(due), Number(due) < 0 ? 9 : 16), status: String(status) as TaskRecord["status"], priority: String(priority) as TaskRecord["priority"] }));
  const activities: ActivityRecord[] = [
    ["a1", "Proposal shared", "Maya Hassan · Luna Commerce", -1, "email"],
    ["a2", "Discovery call completed", "Lina Kareem · Clinica One", -1, "call"],
    ["a3", "Deal marked won", "Omar Nabil · CloudSync", -2, "won"],
    ["a4", "Scope review scheduled", "Omar Nabil · Vertex Logistics", -3, "meeting"],
  ].map(([id, title, detail, occurred, kind]) => ({ id: String(id), title: String(title), detail: String(detail), occurredAt: daysFrom(now, Number(occurred)), kind: String(kind) as ActivityRecord["kind"] }));
  return { deals, leads, tasks, activities };
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}
