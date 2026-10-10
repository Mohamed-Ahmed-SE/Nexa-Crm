import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listWorkspaceLeads } from "@/lib/leads/repository";
import { parseLeadSearchParams } from "@/lib/leads/schema";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const leadId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";
const tagId = "5c144f7b-80bd-48f0-8f4c-75a1859176e6";

type TagAssociation = { entity_id: string; workspace_id: string; entity_type: string; tag_id: string };

function leadsClient(tagMatches: TagAssociation[] = [{ entity_id: leadId, workspace_id: workspaceId, entity_type: "lead", tag_id: tagId }]) {
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
          ? [...new Map(tagMatches.map(({ entity_id, workspace_id }) => [entity_id, { id: entity_id, workspace_id, archived_at: null, full_name: "Taylor Reed", company_name: "Acme", email: null, phone: null, job_title: null, source_id: null, status: "qualified", owner_id: null, estimated_value: 0, currency: "USD", notes_summary: null, created_at: "2026-04-01", updated_at: "2026-04-02" }])).values()]
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
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
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

  it("returns no leads when a valid tag has no matching rows", async () => {
    const { supabase } = leadsClient([]);
    const result = await listWorkspaceLeads(supabase as never, workspaceId, "user", "User", params);

    expect(result.leads).toEqual([]);
    expect(result.matchedCount).toBe(0);
  });
});
