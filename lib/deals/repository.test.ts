import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listWorkspaceDeals, listDealTagsByEntityIds, replaceDealTags } from "./repository";
import { parseDealSearchParams } from "./schema";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const dealId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const tagId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

describe("deal tag repository mapping", () => {
  const calls: Array<{ table: string; filters: unknown[][] }> = [];
  let mockSupabase: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    calls.length = 0;
    mockSupabase = {
      from: vi.fn((table: string) => {
        const call = { table, filters: [] as unknown[][] };
        calls.push(call);
        const data = table === "entity_tags" ? [{ entity_id: dealId, tag_id: tagId }] : [{ id: tagId, name: "Strategic", color_token: "blue" }];
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn((...args: unknown[]) => { call.filters.push(args); return query; }),
          in: vi.fn((...args: unknown[]) => { call.filters.push(args); return query; }),
          then: (resolve: (result: { data: typeof data; error: null }) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
        };
        return query;
      }),
    };
  });

  it("maps deal associations while constraining both entity and tag reads to the workspace", async () => {
    await expect(listDealTagsByEntityIds(mockSupabase as never, workspaceId, [dealId])).resolves.toEqual(new Map([
      [dealId, [{ id: tagId, name: "Strategic", color_token: "blue" }]],
    ]));
    expect(calls[0]).toMatchObject({ table: "entity_tags", filters: [["workspace_id", workspaceId], ["entity_type", "deal"], ["entity_id", [dealId]]] });
    expect(calls[1]).toMatchObject({ table: "tags", filters: [["workspace_id", workspaceId], ["id", [tagId]]] });
  });

  it("avoids association queries for an empty deal selection", async () => {
    await expect(listDealTagsByEntityIds(mockSupabase as never, workspaceId, [])).resolves.toEqual(new Map());
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

const retainedTagId = "a541e1c7-2194-41b6-b649-128be6883573";
const removedTagId = "ec4a4a89-0a4b-44fd-8f78-1e4c8a28f604";
const otherDealId = "b29ef537-28f6-46dc-b43b-23c8ca04ea48";

type TagAssociation = { workspace_id: string; entity_type: string; entity_id: string; tag_id: string };

function associationClient(initialAssociations: TagAssociation[], deleteError: Error | null = null) {
  const associations = [...initialAssociations];
  const from = vi.fn((table: string) => {
    const filters: Array<["eq" | "in", string, string | string[]]> = [];
    let deleting = false;
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => { filters.push(["eq", column, value]); return query; }),
      in: vi.fn((column: string, values: string[]) => { filters.push(["in", column, values]); return query; }),
      delete: vi.fn(() => { deleting = true; return query; }),
      then: (resolve: (result: { data: TagAssociation[] | null; error: Error | null }) => unknown) => {
        const matches = (association: TagAssociation) => filters.every(([operator, column, value]) =>
          operator === "eq" ? association[column as keyof TagAssociation] === value : value.includes(association[column as keyof TagAssociation] as string));
        if (deleting && !deleteError) {
          for (let index = associations.length - 1; index >= 0; index--) if (matches(associations[index])) associations.splice(index, 1);
        }
        return Promise.resolve({ data: deleting ? null : associations.filter(matches), error: deleting ? deleteError : null }).then(resolve);
      },
    };
    if (table !== "entity_tags") throw new Error(`Unexpected table: ${table}`);
    return query;
  });
  return { associations, supabase: { from } };
}

describe("deal tag replacement", () => {
  const existingAssociations: TagAssociation[] = [
    { workspace_id: workspaceId, entity_type: "deal", entity_id: dealId, tag_id: retainedTagId },
    { workspace_id: workspaceId, entity_type: "deal", entity_id: dealId, tag_id: removedTagId },
    { workspace_id: "another-workspace", entity_type: "deal", entity_id: dealId, tag_id: removedTagId },
    { workspace_id: workspaceId, entity_type: "contact", entity_id: dealId, tag_id: removedTagId },
    { workspace_id: workspaceId, entity_type: "deal", entity_id: otherDealId, tag_id: removedTagId },
  ];

  it("removes only omitted tags from this workspace's deal association", async () => {
    const { associations, supabase } = associationClient(existingAssociations);

    await expect(replaceDealTags(supabase as never, workspaceId, dealId, [retainedTagId])).resolves.toBe(true);

    expect(associations).toEqual(existingAssociations.filter(({ workspace_id, entity_type, entity_id, tag_id }) =>
      !(workspace_id === workspaceId && entity_type === "deal" && entity_id === dealId && tag_id === removedTagId)));
  });

  it("reports a failed removal without changing associations", async () => {
    const { associations, supabase } = associationClient(existingAssociations, new Error("delete failed"));

    await expect(replaceDealTags(supabase as never, workspaceId, dealId, [retainedTagId])).resolves.toBe(false);

    expect(associations).toEqual(existingAssociations);
  });
});

const defaultPipelineId = "11111111-1111-4111-8111-111111111111";
const otherPipelineId = "22222222-2222-4222-8222-222222222222";

function listingClient() {
  const filtersByTable: Record<string, Array<[string, unknown[]]>> = {};
  const supabase = {
    from: (table: string) => {
      const filters = filtersByTable[table] ??= [];
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order", "range", "or", "in", "gte", "lt", "limit"]) {
        query[method] = (...args: unknown[]) => { filters.push([method, args]); return query; };
      }
      const data = table === "pipelines" ? [{ id: defaultPipelineId, name: "Sales", is_default: true }, { id: otherPipelineId, name: "Partners", is_default: false }] : [];
      query.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
      return query;
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { supabase, filtersByTable };
}

describe("deal list KPI drill-through filters", () => {
  it("lists every pipeline's open deals without a pipeline constraint", async () => {
    const { supabase, filtersByTable } = listingClient();

    const result = await listWorkspaceDeals(supabase as never, workspaceId, "user", "User", parseDealSearchParams({ pipeline: "all", status: "open" }));

    expect(result.pipelineId).toBe("all");
    expect(filtersByTable.deals).toContainEqual(["eq", ["status", "open"]]);
    expect(filtersByTable.deals).toContainEqual(["is", ["archived_at", null]]);
    expect(filtersByTable.deals.some(([method, args]) => method === "eq" && args[0] === "pipeline_id")).toBe(false);
    expect(filtersByTable.pipeline_stages.some(([method, args]) => method === "eq" && args[0] === "pipeline_id")).toBe(false);
    expect(filtersByTable.pipeline_stages[0][1][0]).toContain("pipeline_id");
  });

  it("filters won deals to the half-open won_at range used by the dashboard month", async () => {
    const { supabase, filtersByTable } = listingClient();
    const params = parseDealSearchParams({ pipeline: "all", status: "won", wonFrom: "2026-04-01T00:00:00.000Z", wonTo: "2026-05-01T00:00:00.000Z" });

    await listWorkspaceDeals(supabase as never, workspaceId, "user", "User", params);

    expect(filtersByTable.deals).toContainEqual(["eq", ["status", "won"]]);
    expect(filtersByTable.deals).toContainEqual(["gte", ["won_at", "2026-04-01T00:00:00.000Z"]]);
    expect(filtersByTable.deals).toContainEqual(["lt", ["won_at", "2026-05-01T00:00:00.000Z"]]);
  });

  it("keeps single-pipeline scoping and ignores invalid KPI parameters", async () => {
    const { supabase, filtersByTable } = listingClient();

    const result = await listWorkspaceDeals(supabase as never, workspaceId, "user", "User", parseDealSearchParams({ pipeline: otherPipelineId, status: "bogus", wonFrom: "x" }));

    expect(result.pipelineId).toBe(otherPipelineId);
    expect(filtersByTable.deals).toContainEqual(["eq", ["pipeline_id", otherPipelineId]]);
    expect(filtersByTable.deals.some(([method, args]) => (method === "eq" && args[0] === "status") || method === "gte" || method === "lt")).toBe(false);
  });
});
