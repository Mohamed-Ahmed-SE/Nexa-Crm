import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchWorkspaceRecords } from "@/lib/search/repository";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const leadId = "25b2f10f-e625-4c94-bcf4-f0e9dc3d6f66";

function searchClient() {
  const rows = {
    leads: [{ id: leadId, full_name: "Ada Lovelace", company_name: "Analytical Engines", job_title: "Founder", email: "ada@example.test" }],
    contacts: [],
    companies: [],
    deals: [],
  };
  function query(data: unknown[]) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      or: () => builder,
      limit: () => builder,
      then: (resolve: (response: { data: unknown[]; error: null }) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve, reject),
    };
    return builder;
  }
  return { from: (table: keyof typeof rows) => query(rows[table]) };
}

describe("searchWorkspaceRecords", () => {
  it("maps a matching lead to its detail route with useful display fields", async () => {
    const results = await searchWorkspaceRecords(searchClient() as never, workspaceId, "Ada");

    expect(results.lead).toEqual([{
      id: leadId,
      name: "Ada Lovelace",
      type: "lead",
      context: "Founder · Analytical Engines · ada@example.test",
      href: `/app/leads/${leadId}`,
    }]);
  });
});
