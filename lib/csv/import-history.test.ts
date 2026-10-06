import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseImportHistory, parseImportRowErrors } from "@/lib/csv/import-history";

const savedErrorReport = [{ row: 3, errors: ["email: Invalid email"] }];
const savedJob = {
  id: "9f03f4de-223b-4a72-8ca7-264824ae6816",
  created_at: "2026-04-04T10:30:00.000Z",
  entity: "contacts",
  status: "completed_with_errors",
  total_rows: 2,
  imported_rows: 1,
  rejected_rows: 1,
};

describe("workspace import history data", () => {
  it("keeps row-numbered errors separate from history summaries", () => {
    expect(parseImportHistory([savedJob])).toEqual([savedJob]);
    expect(parseImportRowErrors(savedErrorReport, 1)).toEqual(savedErrorReport);
  });

  it("parses the seeded rejected lead rows in the expected error shape", () => {
    const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");
    const seededLeadsErrorJob = seedSql.match(
      /'90000000-0000-4000-8000-000000000003',\s*'00000000-0000-4000-8000-000000000001',\s*'00000000-0000-4000-8000-000000000101',\s*'leads',\s*'completed_with_errors',\s*\d+,\s*\d+,\s*(\d+),\s*'([^']*)'::jsonb/,
    );
    if (!seededLeadsErrorJob) throw new Error("Seeded leads error job was not found.");

    const rejectedRows = Number(seededLeadsErrorJob[1]);
    const rowErrors = JSON.parse(seededLeadsErrorJob[2]) as unknown;

    expect(rejectedRows).toBe(2);
    expect(parseImportRowErrors(rowErrors, rejectedRows)).toEqual(rowErrors);
  });

  it.each([
    ["row-error count mismatch", [{ row: 3, errors: ["email: Invalid email"] }], 2],
    ["raw row content", [{ row: 3, errors: ["invalid value"], importedRow: { email: "private@example.com" } }], 1],
  ])("rejects %s in an error report", (_scenario, errors, rejectedRows) => {
    expect(parseImportRowErrors(errors, rejectedRows)).toBeNull();
  });

  it("rejects raw imported fields from summary queries", () => {
    expect(parseImportHistory([{ ...savedJob, raw_rows: [{ email: "private@example.com" }] }])).toBeNull();
  });
});
