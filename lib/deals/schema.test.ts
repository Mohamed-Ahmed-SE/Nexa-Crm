import { describe, expect, it } from "vitest";
import { buildDealSearchFilter, dealInputSchema, parseDealSearchParams } from "./schema";

const workspacePipeline = "5d8d7e69-565c-4f99-8599-2f6df86c1025";

describe("dealInputSchema", () => {
  it("normalizes optional values and coerces a valid amount", () => {
    const parsed = dealInputSchema.parse({
      title: "  Renewal  ", companyId: "", contactId: "", amount: "12500.50", expectedCloseDate: "", ownerId: "",
      priority: "high", description: "  ", pipelineId: workspacePipeline,
    });
    expect(parsed).toMatchObject({ title: "Renewal", amount: 12500.5, companyId: null, contactId: null, expectedCloseDate: null, ownerId: null, description: null });
  });

  it.each([
    { title: "   ", amount: "10", priority: "medium" },
    { title: "Valid", amount: "-1", priority: "medium" },
    { title: "Valid", amount: "12", priority: "urgent" },
    { title: "Valid", amount: "12", priority: "medium", expectedCloseDate: "2026-02-30" },
  ])("rejects invalid deal values: $title / $amount / $priority", (partial) => {
    expect(dealInputSchema.safeParse({ ...partial, pipelineId: workspacePipeline }).success).toBe(false);
  });
});

describe("deal search parameters", () => {
  it("accepts valid filters and ignores malformed or repeated values", () => {
    const params = parseDealSearchParams({ q: "  Northwind  ", owner: workspacePipeline, pipeline: [workspacePipeline, "other"] });
    expect(params).toEqual({ q: "Northwind", ownerId: workspacePipeline, pipelineId: "" });
  });

  it("escapes PostgREST filter syntax and skips an empty query", () => {
    expect(buildDealSearchFilter("  ")).toBeNull();
    expect(buildDealSearchFilter('Acme%_"\\')).toBe('title.ilike."%Acme\\%\\_\\"\\\\%"');
  });
});
