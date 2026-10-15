import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), hasWorkspacePermission: vi.fn(() => true), createSupabaseServerClient: vi.fn(), calls: [] as Array<[string, unknown[]]>, taggedAssociations: [{ entity_id: "lead-tagged", workspace_id: "workspace-1", entity_type: "lead", tag_id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6" }] }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/auth/permissions", () => ({ hasWorkspacePermission: mocks.hasWorkspacePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

function createQuery(table: string) {
  let offset = 0;
  const filters: Array<[string, unknown[]]> = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "or", "range", "gte", "lte", "lt", "in"]) {
    query[method] = (...args: unknown[]) => {
      mocks.calls.push([`${table}.${method}`, args]);
      if (method === "range") offset = Number(args[0]);
      filters.push([method, args]);
      return query;
    };
  }
  query.then = (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) => {
    const matchesFilters = (row: Record<string, unknown>) => filters.every(([method, args]) => {
      const field = String(args[0]);
      if (method === "eq" || method === "is") return row[field] === args[1];
      if (method === "in") return (args[1] as unknown[]).includes(row[field]);
      return true;
    });
    const records = table === "pipelines"
      ? [{ id: "a1100000-0000-4000-8000-000000000001", name: "New Business" }]
      : table === "entity_tags"
        ? mocks.taggedAssociations.filter(matchesFilters).slice(offset, offset + 1000).map(({ entity_id }) => ({ entity_id }))
        : table === "leads"
          ? (filters.find(([method, args]) => method === "in" && args[0] === "id")?.[1][1] as string[] ?? [])
            .map((id) => ({ id, workspace_id: "workspace-1", archived_at: null, full_name: id === "lead-tagged" ? "Tagged Lead" : `Lead ${id}`, company_name: "Acme", email: null, phone: null, job_title: null, source_id: null, status: "qualified", owner_id: null, estimated_value: 500, currency: "USD", notes_summary: null, created_at: "2026-04-01", updated_at: "2026-04-02", lead_sources: { name: "Referral" } }))
            .filter(matchesFilters).slice(offset, offset + 1000)
          : table === "tasks"
        ? offset === 0 ? Array.from({ length: 1000 }, (_, index) => taskRow(index === 0 ? "=1+1" : `Task ${index}`)) : [taskRow("Final task")]
        : table === "companies" ? [{ id: "related-company", name: "Northstar Labs" }]
          : offset === 0
            ? Array.from({ length: 1000 }, (_, index) => dealRow(index === 0 ? "=1+1" : `Deal ${index}`))
            : [dealRow("Final deal")];
    return Promise.resolve({ data: records, error: null }).then(resolve, reject);
  };
  return query;
}

function taskRow(title: string) {
  return { id: title, title, description: "Follow up", task_type: "call", status: "open", priority: "high", due_at: "2026-04-05T14:30:00.000Z", assigned_to: "user-1", related_entity_type: "company", related_entity_id: "related-company" };
}

function dealRow(title: string) {
  return {
    id: title, pipeline_id: "a1100000-0000-4000-8000-000000000001", stage_id: "stage-1", title, amount: 2500, currency: "USD", probability: 40,
    expected_close_date: "2026-06-15", owner_id: null, priority: "high", status: "open", description: null,
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-02T00:00:00Z",
    companies: { name: "Acme" }, contacts: { full_name: "Taylor Reed" }, pipeline_stages: { name: "Discovery" },
  };
}

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.taggedAssociations = [{ entity_id: "lead-tagged", workspace_id: "workspace-1", entity_type: "lead", tag_id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6" }];
  mocks.hasWorkspacePermission.mockReturnValue(true);
  mocks.requirePermission.mockReset().mockResolvedValue({ workspaceId: "workspace-1", role: "manager" });
  mocks.createSupabaseServerClient.mockReset().mockResolvedValue({ from: (table: string) => createQuery(table), rpc: vi.fn().mockResolvedValue({ data: [{ user_id: "user-1" }], error: null }) });
});

describe("Leads CSV export route", () => {
  it("exports leads linked after the first 1,000 scoped tag associations", async () => {
    const tagId = "5c144f7b-80bd-48f0-8f4c-75a1859176e6";
    const taggedLeadIds = Array.from({ length: 1005 }, (_, index) => `lead-${String(index).padStart(4, "0")}`);
    mocks.taggedAssociations = [
      ...taggedLeadIds.map((entity_id) => ({ entity_id, workspace_id: "workspace-1", entity_type: "lead", tag_id: tagId })),
      { entity_id: "zz-foreign-workspace", workspace_id: "another-workspace", entity_type: "lead", tag_id: tagId },
      { entity_id: "zz-contact-association", workspace_id: "workspace-1", entity_type: "contact", tag_id: tagId },
      { entity_id: "zz-other-tag", workspace_id: "workspace-1", entity_type: "lead", tag_id: "another-tag" },
    ];

    const response = await GET(new Request(`https://nexa.test/app/leads/export?tagId=${tagId}`), { params: Promise.resolve({ entity: "leads" }) });
    const text = new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(3));

    expect(response.status).toBe(200);
    expect(text).toContain(`Lead ${taggedLeadIds.at(-1)}`);
    expect(text).not.toContain("zz-foreign-workspace");
    expect(text).not.toContain("zz-contact-association");
    expect(text).not.toContain("zz-other-tag");
  });

  it("exports only leads linked to the selected workspace tag", async () => {
    const tagId = "5c144f7b-80bd-48f0-8f4c-75a1859176e6";
    mocks.taggedAssociations.push(
      { entity_id: "foreign-workspace-lead", workspace_id: "another-workspace", entity_type: "lead", tag_id: tagId },
      { entity_id: "contact-association", workspace_id: "workspace-1", entity_type: "contact", tag_id: tagId },
      { entity_id: "lead-with-another-tag", workspace_id: "workspace-1", entity_type: "lead", tag_id: "another-tag" },
    );
    const response = await GET(new Request(`https://nexa.test/app/leads/export?tagId=${tagId}`), { params: Promise.resolve({ entity: "leads" }) });
    const text = new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(3));

    expect(response.status).toBe(200);
    expect(text).toContain("Tagged Lead");
    expect(text).not.toContain("foreign-workspace-lead");
    expect(text).not.toContain("contact-association");
    expect(text).not.toContain("lead-with-another-tag");
  });
});

describe("Deals CSV export route", () => {
  it("exports all filtered workspace deals with related labels and safe CSV headers", async () => {
    const response = await GET(new Request("https://nexa.test/app/deals/export?pipeline=a1100000-0000-4000-8000-000000000001&q=Acme&owner=unassigned"), { params: Promise.resolve({ entity: "deals" }) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = new TextDecoder().decode(bytes.slice(3));

    expect(mocks.requirePermission).toHaveBeenCalledWith("data.export");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body).toContain("\"Deal\",\"Company\",\"Primary contact\",\"Pipeline\",\"Stage\"");
    expect(body).toContain("\"'=1+1\",\"Acme\",\"Taylor Reed\",\"New Business\",\"Discovery\"");
    expect(body).toContain("Final deal");
    expect(mocks.calls.filter(([call]) => call === "deals.range").map(([, args]) => args)).toEqual([[0, 999], [1000, 1999]]);
    expect(mocks.calls).toContainEqual(["deals.eq", ["workspace_id", "workspace-1"]]);
    expect(mocks.calls).toContainEqual(["deals.eq", ["pipeline_id", "a1100000-0000-4000-8000-000000000001"]]);
    expect(mocks.calls).toContainEqual(["deals.is", ["owner_id", null]]);
    expect(mocks.calls).toContainEqual(["deals.or", ['title.ilike."%Acme%"']]);
  });

  it("exports every filtered task page with safe values and workspace-scoped relation labels", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId: "workspace-1", role: "manager", userId: "user-1" });
    const response = await GET(new Request("https://nexa.test/app/tasks/export?view=today&q=A%25_%26&type=call&priority=high&sort=title&timezoneOffset=300&tomorrowTimezoneOffset=240&page=3"), { params: Promise.resolve({ entity: "tasks" }) });
    const text = new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(3));

    expect(mocks.requirePermission).toHaveBeenCalledWith("data.export");
    expect(response.status).toBe(200);
    expect(text).toContain("\"Title\",\"Description\",\"Type\",\"Status\",\"Priority\",\"Due date\",\"Assignee\",\"Related type\",\"Related record\"");
    expect(text).toContain("\"'=1+1\",\"Follow up\",\"call\",\"open\",\"high\",\"2026-04-05T14:30:00.000Z\",\"You\",\"company\",\"Northstar Labs\"");
    expect(text).toContain("Final task");
    expect(mocks.calls.filter(([call]) => call === "tasks.range").map(([, args]) => args)).toEqual([[0, 999], [1000, 1999]]);
    expect(mocks.calls.filter(([call]) => call === "tasks.order").at(-1)).toEqual(["tasks.order", ["id", { ascending: true }]]);
    expect(mocks.calls).toContainEqual(["tasks.eq", ["workspace_id", "workspace-1"]]);
    expect(mocks.calls).toContainEqual(["tasks.eq", ["status", "open"]]);
    expect(mocks.calls.some(([call]) => call === "tasks.gte")).toBe(true);
    expect(mocks.calls.some(([call]) => call === "tasks.lt")).toBe(true);
    expect(mocks.calls).toContainEqual(["tasks.eq", ["task_type", "call"]]);
    expect(mocks.calls).toContainEqual(["tasks.eq", ["priority", "high"]]);
    expect(mocks.calls).toContainEqual(["tasks.or", ['title.ilike."%A\\%\\_&%",description.ilike."%A\\%\\_&%"']]);
    expect(mocks.calls).not.toContainEqual(["tasks.range", [50, 74]]);
    expect(mocks.calls).toContainEqual(["companies.eq", ["workspace_id", "workspace-1"]]);
  });

  it("requires export permission before loading task data", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Not authorized"));

    await expect(GET(new Request("https://nexa.test/app/tasks/export"), { params: Promise.resolve({ entity: "tasks" }) })).rejects.toThrow("Not authorized");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("refuses export when the caller lacks CRM view permission", async () => {
    mocks.hasWorkspacePermission.mockReturnValue(false);
    const response = await GET(new Request("https://nexa.test/app/deals/export"), { params: Promise.resolve({ entity: "deals" }) });

    expect(response.status).toBe(404);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it.each(["toString", "constructor", "__proto__"])("returns 404 for inherited entity name %s before permission or data access", async (entity) => {
    mocks.hasWorkspacePermission.mockClear();
    const response = await GET(new Request(`https://nexa.test/app/${entity}/export`), { params: Promise.resolve({ entity }) });

    expect(response.status).toBe(404);
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.hasWorkspacePermission).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("Export route query filters", () => {
  const encoded = encodeURIComponent;
  const dealPipelineId = "a1100000-0000-4000-8000-000000000001";
  // The deals mock serves two pages, so each filter is applied once per page; compare distinct calls.
  const callsFor = (call: string, column: string) => [...new Map(mocks.calls.filter(([name, args]) => name === call && args[0] === column).map((entry) => [JSON.stringify(entry), entry])).values()];
  const exportEntity = async (entity: "leads" | "deals", query: string) => {
    const response = await GET(new Request(`https://nexa.test/app/${entity}/export?${query}`), { params: Promise.resolve({ entity }) });
    expect(response.status).toBe(200);
  };

  it.each([
    ["createdFrom", `createdFrom=${encoded("2026-04-01T00:00:00Z")}`, "leads.gte", "2026-04-01T00:00:00Z"],
    ["createdFrom with an offset", `createdFrom=${encoded("2026-04-01T00:00:00+02:00")}`, "leads.gte", "2026-04-01T00:00:00+02:00"],
    ["createdTo", `createdTo=${encoded("2026-04-30T23:59:59Z")}`, "leads.lte", "2026-04-30T23:59:59Z"],
  ])("applies the lead %s bound to created_at", async (_label, query, call, value) => {
    await exportEntity("leads", query);

    expect(callsFor(call, "created_at")).toEqual([[call, ["created_at", value]]]);
  });

  it("applies both lead created bounds as an inclusive range", async () => {
    await exportEntity("leads", `createdFrom=${encoded("2026-04-01T00:00:00Z")}&createdTo=${encoded("2026-04-30T23:59:59Z")}`);

    expect(mocks.calls).toContainEqual(["leads.gte", ["created_at", "2026-04-01T00:00:00Z"]]);
    expect(mocks.calls).toContainEqual(["leads.lte", ["created_at", "2026-04-30T23:59:59Z"]]);
  });

  it.each([
    ["no params", ""],
    ["empty bounds", "createdFrom=&createdTo="],
    ["non-datetime text", "createdFrom=yesterday&createdTo=tomorrow"],
    ["date without time", "createdFrom=2026-04-01&createdTo=2026-04-30"],
    ["datetime without offset", `createdFrom=${encoded("2026-04-01T00:00:00")}`],
  ])("adds no lead created_at filter for %s", async (_label, query) => {
    await exportEntity("leads", query);

    expect(callsFor("leads.gte", "created_at")).toEqual([]);
    expect(callsFor("leads.lte", "created_at")).toEqual([]);
  });

  it.each(["open", "won", "lost"])("filters deals by status %s", async (status) => {
    await exportEntity("deals", `status=${status}`);

    expect(callsFor("deals.eq", "status")).toEqual([["deals.eq", ["status", status]]]);
  });

  it.each([
    ["status=all", "status=all"],
    ["an unknown status", "status=archived"],
    ["no status", ""],
  ])("adds no deal status filter for %s", async (_label, query) => {
    await exportEntity("deals", query);

    expect(callsFor("deals.eq", "status")).toEqual([]);
  });

  it.each([
    ["wonFrom", `wonFrom=${encoded("2026-04-01T00:00:00Z")}`, "deals.gte", "2026-04-01T00:00:00Z"],
    ["wonTo", `wonTo=${encoded("2026-05-01T00:00:00Z")}`, "deals.lt", "2026-05-01T00:00:00Z"],
  ])("applies the deal %s bound to won_at", async (_label, query, call, value) => {
    await exportEntity("deals", query);

    expect(callsFor(call, "won_at")).toEqual([[call, ["won_at", value]]]);
    expect(callsFor("deals.lte", "won_at")).toEqual([]);
  });

  it.each([
    ["no params", ""],
    ["empty bounds", "wonFrom=&wonTo="],
    ["non-datetime text", "wonFrom=last-week&wonTo=next-week"],
    ["date without time", "wonFrom=2026-04-01&wonTo=2026-05-01"],
  ])("adds no deal won_at filter for %s", async (_label, query) => {
    await exportEntity("deals", query);

    expect(callsFor("deals.gte", "won_at")).toEqual([]);
    expect(callsFor("deals.lt", "won_at")).toEqual([]);
  });

  it("filters deals by a concrete pipeline id", async () => {
    await exportEntity("deals", `pipeline=${dealPipelineId}`);

    expect(callsFor("deals.eq", "pipeline_id")).toEqual([["deals.eq", ["pipeline_id", dealPipelineId]]]);
  });

  it.each([
    ["pipeline=all", "pipeline=all"],
    ["a non-uuid pipeline", "pipeline=not-a-pipeline"],
    ["no pipeline", ""],
  ])("adds no deal pipeline filter for %s", async (_label, query) => {
    await exportEntity("deals", query);

    expect(callsFor("deals.eq", "pipeline_id")).toEqual([]);
  });
});
