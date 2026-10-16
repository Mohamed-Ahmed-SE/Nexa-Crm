import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listEntityTags, listWorkspaceTags, replaceEntityTags, verifyWorkspaceTagIds } from "./entity-tags";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const entityId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const tagId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

describe("listEntityTags", () => {
  const calls: Array<{ table: string; filters: unknown[][] }> = [];
  let mockSupabase: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    calls.length = 0;
    mockSupabase = {
      from: vi.fn((table: string) => {
        const call = { table, filters: [] as unknown[][] };
        calls.push(call);
        const data = table === "entity_tags" ? [{ entity_id: entityId, tag_id: tagId }] : [{ id: tagId, name: "Strategic", color_token: "blue" }];
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

  it("maps entity associations while constraining both entity and tag reads to the workspace and entity type", async () => {
    await expect(listEntityTags(mockSupabase as never, workspaceId, "contact", [entityId])).resolves.toEqual(new Map([
      [entityId, [{ id: tagId, name: "Strategic", color_token: "blue" }]],
    ]));
    expect(calls[0]).toMatchObject({ table: "entity_tags", filters: [["workspace_id", workspaceId], ["entity_type", "contact"], ["entity_id", [entityId]]] });
    expect(calls[1]).toMatchObject({ table: "tags", filters: [["workspace_id", workspaceId], ["id", [tagId]]] });
  });

  it("avoids association queries for an empty entity selection", async () => {
    await expect(listEntityTags(mockSupabase as never, workspaceId, "company", [])).resolves.toEqual(new Map());
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

const retainedTagId = "a541e1c7-2194-41b6-b649-128be6883573";
const removedTagId = "ec4a4a89-0a4b-44fd-8f78-1e4c8a28f604";
const otherEntityId = "b29ef537-28f6-46dc-b43b-23c8ca04ea48";

type TagAssociation = { workspace_id: string; entity_type: string; entity_id: string; tag_id: string };

function associationClient(initialAssociations: TagAssociation[], deleteError: Error | null = null) {
  const associations = [...initialAssociations];
  const from = vi.fn((table: string) => {
    const filters: Array<["eq" | "in", string, string | string[]]> = [];
    let deleting = false;
    let inserted: TagAssociation[] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => { filters.push(["eq", column, value]); return query; }),
      in: vi.fn((column: string, values: string[]) => { filters.push(["in", column, values]); return query; }),
      delete: vi.fn(() => { deleting = true; return query; }),
      insert: vi.fn((rows: TagAssociation[]) => { inserted = rows; associations.push(...rows); return query; }),
      then: (resolve: (result: { data: TagAssociation[] | null; error: Error | null }) => unknown) => {
        const matches = (association: TagAssociation) => filters.every(([operator, column, value]) =>
          operator === "eq" ? association[column as keyof TagAssociation] === value : value.includes(association[column as keyof TagAssociation] as string));
        if (deleting && !deleteError) {
          for (let index = associations.length - 1; index >= 0; index--) if (matches(associations[index])) associations.splice(index, 1);
        }
        if (inserted.length) return Promise.resolve({ data: inserted, error: null }).then(resolve);
        return Promise.resolve({ data: deleting ? null : associations.filter(matches), error: deleting ? deleteError : null }).then(resolve);
      },
    };
    if (table !== "entity_tags") throw new Error(`Unexpected table: ${table}`);
    return query;
  });
  return { associations, supabase: { from } };
}

describe("replaceEntityTags", () => {
  const existingAssociations: TagAssociation[] = [
    { workspace_id: workspaceId, entity_type: "contact", entity_id: entityId, tag_id: retainedTagId },
    { workspace_id: workspaceId, entity_type: "contact", entity_id: entityId, tag_id: removedTagId },
    { workspace_id: "another-workspace", entity_type: "contact", entity_id: entityId, tag_id: removedTagId },
    { workspace_id: workspaceId, entity_type: "company", entity_id: entityId, tag_id: removedTagId },
    { workspace_id: workspaceId, entity_type: "contact", entity_id: otherEntityId, tag_id: removedTagId },
  ];

  it("removes only omitted tags from this workspace's entity association", async () => {
    const { associations, supabase } = associationClient(existingAssociations);

    await expect(replaceEntityTags(supabase as never, workspaceId, "contact", entityId, [retainedTagId])).resolves.toBe(true);

    expect(associations).toEqual(existingAssociations.filter(({ workspace_id, entity_type, entity_id, tag_id }) =>
      !(workspace_id === workspaceId && entity_type === "contact" && entity_id === entityId && tag_id === removedTagId)));
  });

  it("adds new tags without disturbing other entities or workspaces", async () => {
    const { associations, supabase } = associationClient([
      { workspace_id: workspaceId, entity_type: "lead", entity_id: entityId, tag_id: retainedTagId },
    ]);

    await expect(replaceEntityTags(supabase as never, workspaceId, "lead", entityId, [retainedTagId, removedTagId])).resolves.toBe(true);

    expect(associations).toEqual(expect.arrayContaining([
      { workspace_id: workspaceId, entity_type: "lead", entity_id: entityId, tag_id: retainedTagId },
      { workspace_id: workspaceId, entity_type: "lead", entity_id: entityId, tag_id: removedTagId },
    ]));
    expect(associations).toHaveLength(2);
  });

  it("reports a failed removal without changing associations", async () => {
    const { associations, supabase } = associationClient(existingAssociations, new Error("delete failed"));

    await expect(replaceEntityTags(supabase as never, workspaceId, "contact", entityId, [retainedTagId])).resolves.toBe(false);

    expect(associations).toEqual(existingAssociations);
  });
});

describe("listWorkspaceTags", () => {
  it("orders tags by name within the workspace", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [{ id: tagId, name: "A", color_token: null }], error: null }).then(resolve),
    };
    const supabase = { from: vi.fn(() => query) };

    await expect(listWorkspaceTags(supabase as never, workspaceId)).resolves.toEqual([{ id: tagId, name: "A", color_token: null }]);
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.order).toHaveBeenCalledWith("name");
  });
});

describe("verifyWorkspaceTagIds", () => {
  it("accepts an empty list without querying", async () => {
    const supabase = { from: vi.fn() };
    await expect(verifyWorkspaceTagIds(supabase as never, workspaceId, [])).resolves.toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("accepts tag IDs that all belong to the workspace", async () => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [{ id: tagId }], error: null }).then(resolve) };
    const supabase = { from: vi.fn(() => query) };
    await expect(verifyWorkspaceTagIds(supabase as never, workspaceId, [tagId])).resolves.toBe(true);
  });

  it("rejects a foreign-workspace tag ID", async () => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
    const supabase = { from: vi.fn(() => query) };
    await expect(verifyWorkspaceTagIds(supabase as never, workspaceId, [tagId])).resolves.toBe(false);
  });
});
