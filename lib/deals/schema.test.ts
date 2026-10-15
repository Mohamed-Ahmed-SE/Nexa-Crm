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

  it("accepts a unique list of UUID tag IDs and rejects malformed or repeated IDs", () => {
    const validTag = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";
    const base = { title: "Renewal", amount: "10", priority: "medium", pipelineId: workspacePipeline };
    expect(dealInputSchema.safeParse({ ...base, tagIds: [validTag] }).success).toBe(true);
    expect(dealInputSchema.safeParse({ ...base, tagIds: ["not-a-uuid"] }).success).toBe(false);
    expect(dealInputSchema.safeParse({ ...base, tagIds: [validTag, validTag] }).success).toBe(false);
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
    expect(params).toEqual({ q: "Northwind", ownerId: workspacePipeline, pipelineId: "", status: "all", wonFrom: "", wonTo: "" });
  });

  it("parses KPI status, all-pipeline, and won-range filters while discarding malformed values", () => {
    expect(parseDealSearchParams({ pipeline: "all", status: "won", wonFrom: "2026-04-01T00:00:00.000Z", wonTo: "2026-04-15T12:00:00.000Z" })).toEqual({
      q: "", ownerId: "", pipelineId: "all", status: "won", wonFrom: "2026-04-01T00:00:00.000Z", wonTo: "2026-04-15T12:00:00.000Z",
    });
    expect(parseDealSearchParams({ status: "invalid", wonFrom: "yesterday", wonTo: ["2026-04-15T12:00:00.000Z"] })).toMatchObject({
      status: "all", wonFrom: "", wonTo: "", pipelineId: "",
    });
  });

  it("escapes PostgREST filter syntax and skips an empty query", () => {
    expect(buildDealSearchFilter("  ")).toBeNull();
    expect(buildDealSearchFilter('Acme%_"\\')).toBe('title.ilike."%Acme\\%\\_\\"\\\\%"');
  });
});
