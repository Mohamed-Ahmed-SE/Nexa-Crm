import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { createCompanyAction, updateCompanyAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
const companyId = "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79";
const tagId = "c2155412-d8a0-4792-b2bc-f6064b2798f4";
const foreignTagId = "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084";

function companyForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("name", "Acme Group");
  form.set("website", "");
  for (const key of ["industry", "employeeSize", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "description", "ownerId"]) form.set(key, "");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

type EntityTagRow = { workspace_id: string; entity_type: string; entity_id: string; tag_id: string };

function buildSupabase({ existingTags = [] as EntityTagRow[], tagRows = [{ id: tagId }] as Array<{ id: string }> } = {}) {
  const entityTags = [...existingTags];
  const insertedCalls: unknown[][] = [];
  const companyInsertQuery = { select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: companyId }, error: null }) };
  const companyUpdateQuery = { eq: vi.fn().mockReturnThis(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  const companyReadQuery = { eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: companyId, owner_id: userId }, error: null }) };
  const companyDuplicateQuery = { eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  const from = vi.fn((table: string) => {
    if (table === "companies") return {
      select: vi.fn((columns: string) => columns === "id,name,website" ? companyDuplicateQuery : companyReadQuery),
      insert: vi.fn().mockReturnValue(companyInsertQuery),
      update: vi.fn().mockReturnValue(companyUpdateQuery),
    };
    if (table === "tags") {
      const tagQuery = { eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: tagRows, error: null }).then(resolve) };
      return { select: vi.fn().mockReturnValue(tagQuery) };
    }
    if (table === "entity_tags") {
      const filters: Array<["eq", string, string]> = [];
      let deleting = false;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: string) => { filters.push(["eq", column, value]); return query; }),
        in: vi.fn((column: string, values: string[]) => { filters.push(["eq", column, values.join(",")]); return query; }),
        delete: vi.fn(() => { deleting = true; return query; }),
        insert: vi.fn((rows: EntityTagRow[]) => { insertedCalls.push(rows); entityTags.push(...rows); return query; }),
        then: (resolve: (result: unknown) => unknown) => {
          const matches = (row: EntityTagRow) => filters.every(([, column, value]) => (row as unknown as Record<string, string>)[column] === value || value.split(",").includes((row as unknown as Record<string, string>)[column]));
          if (deleting) {
            for (let index = entityTags.length - 1; index >= 0; index--) if (matches(entityTags[index])) entityTags.splice(index, 1);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (insertedCalls.length && insertedCalls.at(-1)) return Promise.resolve({ data: insertedCalls.at(-1), error: null }).then(resolve);
          return Promise.resolve({ data: entityTags.filter(matches), error: null }).then(resolve);
        },
      };
      return query;
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });
  return { from, entityTags, insertedCalls, rpc: vi.fn().mockResolvedValue({ data: [{ user_id: userId }], error: null }) };
}

describe("company tag management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a workspace tag to a newly created company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    const supabase = buildSupabase();
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await createCompanyAction({}, companyForm({ tagIds: tagId, confirmDuplicate: "true" }));

    expect(result).toMatchObject({ ok: true });
    expect(supabase.insertedCalls).toContainEqual([{ workspace_id: workspaceId, entity_type: "company", entity_id: companyId, tag_id: tagId }]);
  });

  it("adds then removes a tag, leaving the expected association rows", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    const existing: EntityTagRow[] = [{ workspace_id: workspaceId, entity_type: "company", entity_id: companyId, tag_id: tagId }];
    const supabase = buildSupabase({ existingTags: existing });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await updateCompanyAction({}, companyForm({ id: companyId }));

    expect(result).toMatchObject({ ok: true });
    expect(supabase.entityTags).toEqual([]);
  });

  it("rejects a foreign-workspace tag before creating a company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "member" });
    const supabase = buildSupabase({ tagRows: [] });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await createCompanyAction({}, companyForm({ tagIds: foreignTagId }));

    expect(result).toEqual({ message: "Choose tags from this workspace." });
    expect(supabase.insertedCalls).toHaveLength(0);
  });

  it("rejects a foreign-workspace tag before updating a company", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    const supabase = buildSupabase({ tagRows: [] });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const result = await updateCompanyAction({}, companyForm({ id: companyId, tagIds: foreignTagId }));

    expect(result).toEqual({ message: "Choose tags from this workspace." });
  });

  it("denies a viewer without create permission", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Not found"));
    const supabase = buildSupabase();
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await expect(createCompanyAction({}, companyForm({ tagIds: tagId }))).rejects.toThrow("Not found");
  });
});
