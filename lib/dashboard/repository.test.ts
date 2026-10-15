import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DashboardUnavailableError, loadWorkspaceDashboard } from "@/lib/dashboard/repository";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const unsafeErrorDetails = "secret-token raw-row-value";

type QueryError = { code: string; message: string; details: string };
type QueryResponse = { data: unknown; error: QueryError | null };
type Query = {
  select: (...args: unknown[]) => Query;
  eq: (...args: unknown[]) => Query;
  is: (...args: unknown[]) => Query;
  not: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  limit: (...args: unknown[]) => Query;
  gte: (...args: unknown[]) => Query;
  lte: (...args: unknown[]) => Query;
  in: (...args: unknown[]) => Query;
  maybeSingle: () => Promise<QueryResponse>;
  then: (resolve: (response: QueryResponse) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>;
};

type DashboardClientOptions = { failedReads?: Record<string, QueryError> };

function dashboardClient({ failedReads = {} }: DashboardClientOptions = {}) {
  const tables = {
    deals: [{ id: "deal-1", title: "Renewal", amount: 1200, currency: "USD", status: "open", stage_id: "stage-1", pipeline_id: "pipeline-1", owner_id: "member-1", pipeline_stages: { name: "Qualified", stage_type: "open" }, companies: { name: "Acme" }, contacts: { first_name: "Taylor", last_name: "Reed" } }],
    pipeline_stages: [{ id: "stage-1", pipeline_id: "pipeline-1", name: "Qualified", position: 1, stage_type: "open", pipelines: { name: "Sales" } }],
    leads: [{ id: "lead-1", created_at: "2026-04-15T10:00:00.000Z", lead_sources: { name: "Referral" } }],
    tasks: [
      { id: "task-company", title: "Call company", due_at: "2026-04-16T10:00:00.000Z", priority: "high", related_entity_type: "company", related_entity_id: "company-1" },
      { id: "task-lead", title: "Call lead", due_at: "2026-04-16T11:00:00.000Z", priority: "medium", related_entity_type: "lead", related_entity_id: "lead-1" },
    ],
    activities: [{ id: "activity-contact", subject: "Meeting", activity_type: "meeting", occurred_at: "2026-04-15T09:00:00.000Z", related_entity_type: "contact", related_entity_id: "contact-1" }],
  };
  const from = (table: keyof typeof tables | "workspaces" | "companies" | "contacts") => {
    let selection = "";
    let labelRead = false;
    const query: Query = {
      select: (...args) => { selection = String(args[0]); return query; },
      eq: () => query, is: () => query, not: () => query, order: () => query,
      limit: () => query, gte: () => query, lte: () => query,
      in: (...args) => { if (args[0] === "id") labelRead = true; return query; },
      maybeSingle: async () => ({ data: { default_currency: "USD", timezone: "UTC" }, error: failedReads.workspaces ?? null }),
      then: (resolve, reject) => Promise.resolve(responseFor(table, selection, labelRead, tables, failedReads)).then(resolve, reject),
    };
    return query;
  };
  return {
    from,
    rpc: async (name: string) => {
      if (name === "get_workspace_report_member_labels") {
        const error = failedReads[name] ?? null;
        return { data: error ? [] : [{ user_id: "member-1", display_name: "Sam Rivera" }], error };
      }
      return { data: [], error: failedReads[name] ?? null };
    },
  };
}

function responseFor(
  table: string,
  selection: string,
  labelRead: boolean,
  tables: Record<string, Array<Record<string, unknown>>>,
  failedReads: Record<string, QueryError>,
): QueryResponse {
  const queryName = labelRead ? `${table} labels` : table === "activities" && selection === "related_entity_id,occurred_at" ? "deal activities" : table;
  const error = failedReads[queryName];
  const data = table === "workspaces" ? { default_currency: "USD", timezone: "UTC" }
    : labelRead || table === "leads" && selection === "id,full_name,status,created_at" ? []
      : table === "activities" && selection === "related_entity_id,occurred_at" ? [] : tables[table] ?? [];
  return { data, error: error ?? null };
}

afterEach(() => vi.restoreAllMocks());

describe("workspace dashboard repository query boundaries", () => {
  it("preserves core dashboard rows when display-label enrichment reads fail", async () => {
    const logDiagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = dashboardClient({
      failedReads: {
        get_workspace_report_member_labels: { code: "42501", message: unsafeErrorDetails, details: unsafeErrorDetails },
        "companies labels": { code: "42501", message: unsafeErrorDetails, details: unsafeErrorDetails },
        "contacts labels": { code: "42501", message: unsafeErrorDetails, details: unsafeErrorDetails },
        "leads labels": { code: "42501", message: unsafeErrorDetails, details: unsafeErrorDetails },
      },
    });

    const dashboard = await loadWorkspaceDashboard(supabase as never, workspaceId, new Date("2026-04-15T12:00:00.000Z"));

    expect(dashboard).toMatchObject({ monthStart: "2026-04-01T00:00:00.000Z", monthEnd: "2026-05-01T00:00:00.000Z", now: "2026-04-15T12:00:00.000Z" });
    expect(dashboard.deals[0]).toMatchObject({ id: "deal-1", title: "Renewal", owner: "Workspace member", company: "Acme", contact: "Taylor Reed" });
    expect(dashboard.stages.map(({ id }) => id)).toEqual(["stage-1"]);
    expect(dashboard.leads.map(({ id }) => id)).toEqual(["lead-1"]);
    expect(dashboard.tasks.map(({ relatedTo }) => relatedTo)).toEqual([null, null]);
    expect(dashboard.activities[0].relatedTo).toBeNull();
    expect(logDiagnostic.mock.calls.map(([diagnostic]) => diagnostic)).toEqual(expect.arrayContaining([
      { query: "get_workspace_report_member_labels", code: "42501" },
      { query: "companies labels", code: "42501" },
      { query: "contacts labels", code: "42501" },
      { query: "leads labels", code: "42501" },
    ]));
    expect(JSON.stringify(logDiagnostic.mock.calls)).not.toContain(unsafeErrorDetails);
  });

  it("fails closed when inactive-owner status cannot be verified", async () => {
    const logDiagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = dashboardClient({
      failedReads: { list_inactive_workspace_member_ids: { code: "42501", message: unsafeErrorDetails, details: unsafeErrorDetails } },
    });

    await expect(loadWorkspaceDashboard(supabase as never, workspaceId)).rejects.toBeInstanceOf(DashboardUnavailableError);

    expect(logDiagnostic).toHaveBeenCalledExactlyOnceWith({ query: "list_inactive_workspace_member_ids", code: "42501" });
    expect(JSON.stringify(logDiagnostic.mock.calls)).not.toContain(unsafeErrorDetails);
  });

  it("keeps primary query failures fatal and logs only the safe query name and code", async () => {
    const logDiagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = dashboardClient({
      failedReads: { deals: { code: "XX000", message: unsafeErrorDetails, details: unsafeErrorDetails } },
    });

    await expect(loadWorkspaceDashboard(supabase as never, workspaceId)).rejects.toBeInstanceOf(DashboardUnavailableError);

    expect(logDiagnostic).toHaveBeenCalledExactlyOnceWith({ query: "deals", code: "XX000" });
    expect(JSON.stringify(logDiagnostic.mock.calls)).not.toContain(unsafeErrorDetails);
  });
});
