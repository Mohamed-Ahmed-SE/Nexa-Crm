export type DashboardDeal = {
  id: string;
  title: string;
  company: string | null;
  contact: string | null;
  stage: string;
  stageId: string;
  pipelineId: string;
  stageType: "open" | "won" | "lost";
  amount: number;
  currency: string;
  owner: string;
  expectedCloseDate: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  wonAt: string | null;
  source: string;
  status: "open" | "won" | "lost";
};

export type DashboardStage = { id: string; name: string; pipelineId: string; pipelineName: string; position: number; stageType: "open" | "won" | "lost" };
export type DashboardTask = { id: string; title: string; dueAt: string; priority: string; relatedTo: string | null; relatedId: string | null; relatedHref: string | null };
export type DashboardActivity = { id: string; subject: string; kind: string; occurredAt: string; relatedTo: string | null; relatedHref: string | null };
export type DashboardSource = { name: string; count: number };

export type WorkspaceDashboardData = {
  currency: string;
  timeZone: string;
  deals: DashboardDeal[];
  stages: DashboardStage[];
  leads: Array<{ id: string; createdAt: string; source: string }>;
  tasks: DashboardTask[];
  activities: DashboardActivity[];
  today: string;
};

export type DashboardSummary = {
  pipelineValue: number;
  openDeals: number;
  newLeads: number;
  wonRevenue: number;
  overdueTasks: number;
  closingThisMonth: number;
  pipelineByStage: Array<{ id: string; name: string; pipelineName: string; count: number; value: number }>;
  dealsBySource: DashboardSource[];
  tasksToday: DashboardTask[];
  attentionDeals: Array<{ deal: DashboardDeal; reason: string }>;
};
