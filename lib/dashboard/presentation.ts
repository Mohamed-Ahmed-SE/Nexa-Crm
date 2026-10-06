import { dashboardDateKey, dashboardDateStart, nextDashboardDate } from "@/lib/dashboard/calendar";
import type { DashboardSummary, WorkspaceDashboardData } from "@/lib/dashboard/types";

export function shapeWorkspaceDashboard(workspaceDashboard: WorkspaceDashboardData, now = new Date()): DashboardSummary {
  const { today, timeZone, currency, deals, leads, tasks, stages } = workspaceDashboard;
  const month = today.slice(0, 7);
  const monthStart = dashboardDateStart(`${month}-01`, timeZone).valueOf();
  const workspaceCurrencyDeals = deals.filter((deal) => deal.currency === currency);
  const openDeals = deals.filter((deal) => deal.status === "open");
  return {
    pipelineValue: sumAmounts(workspaceCurrencyDeals.filter((deal) => deal.status === "open")),
    openDeals: openDeals.length,
    newLeads: leads.filter((lead) => Date.parse(lead.createdAt) >= monthStart && Date.parse(lead.createdAt) <= now.valueOf()).length,
    wonRevenue: sumAmounts(workspaceCurrencyDeals.filter((deal) => deal.status === "won" && deal.wonAt && dashboardDateKey(new Date(deal.wonAt), timeZone).slice(0, 7) === month)),
    overdueTasks: tasks.filter((task) => Date.parse(task.dueAt) < now.valueOf()).length,
    closingThisMonth: openDeals.filter((deal) => deal.expectedCloseDate?.startsWith(month)).length,
    pipelineByStage: summarizePipelineStages(stages, openDeals, currency),
    dealsBySource: summarizeDealSources(deals),
    tasksToday: tasksDueToday(tasks, today, timeZone),
    attentionDeals: dealsNeedingAttention(openDeals, tasks, today, now),
  };
}

function sumAmounts(deals: WorkspaceDashboardData["deals"]): number {
  return deals.reduce((total, deal) => total + deal.amount, 0);
}

function summarizePipelineStages(stages: WorkspaceDashboardData["stages"], openDeals: WorkspaceDashboardData["deals"], currency: string) {
  const totals = new Map(stages.filter((stage) => stage.stageType === "open").map((stage) => [stage.id, { id: stage.id, name: stage.name, pipelineName: stage.pipelineName, count: 0, value: 0 }]));
  for (const deal of openDeals) {
    const stageTotal = totals.get(deal.stageId);
    if (stageTotal) {
      stageTotal.count += 1;
      if (deal.currency === currency) stageTotal.value += deal.amount;
    }
  }
  return [...totals.values()];
}

function summarizeDealSources(deals: WorkspaceDashboardData["deals"]) {
  const sourceCounts = new Map<string, number>();
  for (const deal of deals) sourceCounts.set(deal.source || "Unspecified", (sourceCounts.get(deal.source || "Unspecified") ?? 0) + 1);
  return [...sourceCounts].map(([name, count]) => ({ name, count })).sort((first, second) => second.count - first.count);
}

function tasksDueToday(tasks: WorkspaceDashboardData["tasks"], today: string, timeZone: string) {
  const dayStart = dashboardDateStart(today, timeZone).valueOf();
  const nextDayStart = dashboardDateStart(nextDashboardDate(today), timeZone).valueOf();
  return tasks.filter((task) => Date.parse(task.dueAt) >= dayStart && Date.parse(task.dueAt) < nextDayStart)
    .sort((first, second) => first.dueAt.localeCompare(second.dueAt));
}

function dealsNeedingAttention(openDeals: WorkspaceDashboardData["deals"], tasks: WorkspaceDashboardData["tasks"], today: string, now: Date) {
  const attentionDeals: DashboardSummary["attentionDeals"] = [];
  for (const deal of openDeals) {
    if (deal.expectedCloseDate && deal.expectedCloseDate < today) attentionDeals.push({ deal, reason: "Expected close date has passed" });
    else if (now.valueOf() - Date.parse(deal.createdAt) >= 14 * 86_400_000 && (!deal.lastActivityAt || now.valueOf() - Date.parse(deal.lastActivityAt) >= 14 * 86_400_000)) attentionDeals.push({ deal, reason: "No activity in the last 14 days" });
    else if (!tasks.some((task) => task.relatedId === deal.id && Date.parse(task.dueAt) > now.valueOf())) attentionDeals.push({ deal, reason: "No future task scheduled" });
  }
  return attentionDeals.sort((first, second) => (first.deal.expectedCloseDate ?? "9999").localeCompare(second.deal.expectedCloseDate ?? "9999")).slice(0, 5);
}

