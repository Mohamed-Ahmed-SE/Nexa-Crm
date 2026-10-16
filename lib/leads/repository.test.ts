import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getLeadDetail, listWorkspaceLeads } from "@/lib/leads/repository";
import { parseLeadSearchParams } from "@/lib/leads/schema";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const tagId = "5c144f7b-80bd-48f0-8f4c-75a1859176e6";

type TagAssociation = { entity_id: string; workspace_id: string; entity_type: string; tag_id: string };

function leadsClient(
  tagMatches: TagAssociation[] = [{ entity_id: leadId, workspace_id: workspaceId, entity_type: "lead", tag_id: tagId }],
  inactiveOwnerIds: string[] = [],
) {
  const queryFactory = (table: string) => {
    const filters: Array<[string, unknown[]]> = [];
    let head = false;
    let offset = 0;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "range", "or", "in"]) {
      query[method] = (...args: unknown[]) => {
        if (method === "select") head = (args[1] as { head?: boolean } | undefined)?.head ?? false;
        if (method === "range") offset = Number(args[0]);
        filters.push([method, args]);
        return query;
      };
    }
    query.maybeSingle = () => Promise.resolve({ data: { default_currency: "USD" }, error: null });
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      const rows: Array<Record<string, unknown>> = table === "entity_tags"
        ? tagMatches
        : table === "leads"
          ? [...new Map(tagMatches.map(({ entity_id, workspace_id }) => [entity_id, { id: entity_id, workspace_id, archived_at: null, full_name: "Taylor Reed", company_name: "Acme", email: null, phone: null, job_title: null, source_id: null, status: "qualified", owner_id: inactiveOwnerIds[0] ?? null, estimated_value: 0, currency: "USD", notes_summary: null, created_at: "2026-04-01", updated_at: "2026-04-02" }])).values()]
          : table === "tags" ? [{ id: tagId, workspace_id: workspaceId, name: "Priority", color_token: "blue", is_active: true }]
            : [];
      const matchingRows = rows.filter((row) => filters.every(([method, args]) => {
        const field = args[0] as keyof typeof row;
        if (method === "eq" || method === "is") return row[field] === args[1];
        if (method === "in") return (args[1] as unknown[]).includes(row[field]);
        return true;
      }));
      const data = table === "leads" && !head
        ? matchingRows.slice(offset, offset + 25)
        : table === "entity_tags" ? matchingRows.slice(offset, offset + 1000)
          : table === "tags" ? matchingRows.map(({ id, name, color_token }) => ({ id, name, color_token }))
            : matchingRows;
      return Promise.resolve({ data, error: null, count: table === "leads" ? matchingRows.length : null }).then(resolve, reject);
    };
    return query;
  };
  const supabase = {
    from: vi.fn((table: string) => queryFactory(table)),
    rpc: vi.fn((name: string) => Promise.resolve({ data: name === "list_inactive_workspace_member_ids" ? inactiveOwnerIds.map((user_id) => ({ user_id })) : [], error: null })),
  };
  return { supabase };
}

const params = parseLeadSearchParams({ tagId });

describe("lead repository tag filtering", () => {
  it("returns tags only for the current workspace's lead rows", async () => {
    const associations = [
      { entity_id: leadId, workspace_id: workspaceId, entity_type: "lead", tag_id: tagId },
      { entity_id: leadId, workspace_id: "another-workspace", entity_type: "lead", tag_id: tagId },
      { entity_id: leadId, workspace_id: workspaceId, entity_type: "contact", tag_id: tagId },
    ];
    const { supabase } = leadsClient(associations);
    const result = await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", params);

    expect(result.leads.map(({ id }) => id)).toEqual([leadId]);
    expect(result.leads[0].tags).toEqual([{ id: tagId, name: "Priority", color_token: "blue" }]);
  });

  it("includes lead IDs from tag-link pages after the first 1,000 matches", async () => {
    const taggedRows = Array.from({ length: 1005 }, (_, index) => ({ entity_id: `lead-${String(index).padStart(4, "0")}`, workspace_id: workspaceId, entity_type: "lead", tag_id: tagId }));
    const expectedPageIds = taggedRows.slice(-5).map(({ entity_id }) => entity_id);
    const { supabase } = leadsClient(taggedRows);

    const result = await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", parseLeadSearchParams({ tagId, page: "41" }));

    expect(result.leads.map(({ id }) => id)).toEqual(expectedPageIds);
    expect(result.matchedCount).toBe(1005);
  });

  it("marks inactive historical lead owners without adding them to assignment options", async () => {
    const inactiveOwnerId = "d75e4602-c376-4ce1-a95f-9788acbe7c6a";
    const { supabase } = leadsClient(undefined, [inactiveOwnerId]);

    const result = await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", params);

    expect(result.leads[0]).toMatchObject({
      owner_id: inactiveOwnerId,
      ownerLabel: "Workspace member · d75e46 · Inactive user",
    });
    expect(result.owners).toEqual([]);
  });

  it("returns no leads when a valid tag has no matching rows", async () => {
    const { supabase } = leadsClient([]);
    const result = await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", params);

    expect(result.leads).toEqual([]);
    expect(result.matchedCount).toBe(0);
  });
});

function recordingLeadsClient() {
  const leadFilters: Array<[string, unknown[]]> = [];
  const supabase = {
    from: (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order", "range", "or", "in", "gte", "lte"]) {
        query[method] = (...args: unknown[]) => { if (table === "leads") leadFilters.push([method, args]); return query; };
      }
      query.maybeSingle = () => Promise.resolve({ data: { default_currency: "USD" }, error: null });
      query.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
      return query;
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { supabase, leadFilters };
}

describe("lead repository created-date filtering", () => {
  it("applies the dashboard's inclusive month-start and now bounds to non-archived leads", async () => {
    const { supabase, leadFilters } = recordingLeadsClient();
    const dashboardRange = parseLeadSearchParams({ createdFrom: "2026-04-01T00:00:00.000Z", createdTo: "2026-04-15T12:00:00.000Z" });

    await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", dashboardRange);

    expect(leadFilters).toContainEqual(["is", ["archived_at", null]]);
    expect(leadFilters).toContainEqual(["gte", ["created_at", "2026-04-01T00:00:00.000Z"]]);
    expect(leadFilters).toContainEqual(["lte", ["created_at", "2026-04-15T12:00:00.000Z"]]);
  });

  it("does not add created-date filters when the bounds are absent or malformed", async () => {
    const { supabase, leadFilters } = recordingLeadsClient();

    await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", parseLeadSearchParams({ createdFrom: "yesterday" }));

    expect(leadFilters.some(([method]) => method === "gte" || method === "lte")).toBe(false);
  });
});

describe("lead detail notes", () => {
  it("loads note authors and orders pinned notes first, then newest", async () => {
    const noteOrders: Array<[string, unknown]> = [];
    let noteSelect = "";
    const notes = [{ id: "note-1", body: "Pinned", created_by: "user-1", created_at: "2026-04-01T00:00:00Z", is_pinned: true }];
    const fromQuery = (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "in", "order", "limit"]) {
        query[method] = (...args: unknown[]) => {
          if (table === "notes" && method === "select") noteSelect = String(args[0]);
          if (table === "notes" && method === "order") noteOrders.push([String(args[0]), args[1]]);
          return query;
        };
      }
      query.maybeSingle = () => Promise.resolve({ data: table === "leads" ? { id: leadId, owner_id: null, source_id: null } : null, error: null });
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: table === "notes" ? notes : [], error: null }).then(resolve, reject);
      return query;
    };
    const supabase = { from: vi.fn(fromQuery), rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) };

    const detail = await getLeadDetail(supabase as never, { workspaceId, userId: "user-1", fullName: "Taylor", id: leadId });

    expect(noteSelect).toContain("created_by");
    expect(noteOrders).toEqual([["is_pinned", { ascending: false }], ["created_at", { ascending: false }]]);
    expect(detail?.notes).toEqual(notes);
  });
});

describe("lead detail activity timeline", () => {
  it("loads the creator and system flag needed to authorize activity edits, scoped to this lead", async () => {
    const activities = [{ id: "activity-1", activity_type: "call", subject: "Call", body: null, occurred_at: "2026-04-03T12:00:00Z", created_by: "user-1", is_system_event: false }];
    const activityCalls: Array<[string, unknown[]]> = [];
    const fromQuery = (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "in", "order", "limit"]) {
        query[method] = (...args: unknown[]) => {
          if (table === "activities") activityCalls.push([method, args]);
          return query;
        };
      }
      query.maybeSingle = () => Promise.resolve({ data: table === "leads" ? { id: leadId, owner_id: null, source_id: null } : null, error: null });
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: table === "activities" ? activities : [], error: null }).then(resolve, reject);
      return query;
    };
    const supabase = { from: vi.fn(fromQuery), rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) };

    const detail = await getLeadDetail(supabase as never, { workspaceId, userId: "user-1", fullName: "Taylor", id: leadId });

    const selected = String(activityCalls.find(([method]) => method === "select")?.[1][0]);
    expect(selected.split(",").map((column) => column.trim())).toEqual(expect.arrayContaining(["id", "created_by", "is_system_event"]));
    expect(activityCalls.filter(([method]) => method === "eq").map(([, args]) => args)).toEqual([["workspace_id", workspaceId], ["related_entity_type", "lead"], ["related_entity_id", leadId]]);
    expect(detail?.activities).toEqual(activities);
  });
});
