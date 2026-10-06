import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "@/lib/csv/csv";
import { mappedCsvRow, prepareImportRow, suggestedMappings, validateImportRow } from "@/lib/csv/import";

const csvWithDataRows = (count: number) => ["Name", ...Array.from({ length: count }, (_, index) => `Row ${index + 1}`)].join("\n");

describe("CSV parsing", () => {
  it("reads quoted commas, escaped quotes, line breaks, BOM, and CRLF rows", () => {
    expect(parseCsv('\uFEFFName,Notes\r\n"Taylor, Reed","said ""hello""\r\nagain"\r\nJordan,Follow-up')).toEqual({
      headers: ["Name", "Notes"], rows: [["Taylor, Reed", 'said "hello"\r\nagain'], ["Jordan", "Follow-up"]],
    });
  });

  it("accepts exactly 10,000 data rows after the header", () => {
    expect(parseCsv(csvWithDataRows(10_000)).rows).toHaveLength(10_000);
  });

  it("rejects 10,001 data rows after the header", () => {
    expect(() => parseCsv(csvWithDataRows(10_001))).toThrow("CSV files may contain at most 10,000 rows.");
  });

  it("continues to ignore blank data lines", () => {
    expect(parseCsv("Name\n\nAlice\n \nBob\n\n")).toEqual({ headers: ["Name"], rows: [["Alice"], ["Bob"]] });
  });

  it.each([
    ["unclosed quotation", 'Name,Notes\nTaylor,"unfinished'],
    ["duplicate columns", "Name,name\nTaylor,Reed"],
    ["blank headers", " , \nTaylor,Reed"],
    ["column count mismatch", "Name,Email\nTaylor"],
    ["text after a quoted field", 'Name,Email\n"Taylor"x,taylor@example.com'],
  ])("rejects %s before mapping", (_scenario, content) => {
    expect(() => parseCsv(content)).toThrow();
  });
});

describe("CSV field mapping and row validation", () => {
  it("suggests entity-specific column mappings and supplies create defaults", () => {
    const headers = ["First Name", "Last Name", "Email"];
    const mapping = suggestedMappings("contacts", headers);
    const row = mappedCsvRow(headers, ["Taylor", "Reed", "taylor@example.com"], mapping, "contacts");
    expect(validateImportRow("contacts", row).success).toBe(true);
    expect(prepareImportRow("contacts", row).lifecycleStatus).toBe("active");
    expect(suggestedMappings("leads", ["Name", "Lead Source"])).toEqual([0, -1, -1, -1, -1, 1, -1, -1, -1, -1]);
    expect(suggestedMappings("companies", ["Company Name"])[0]).toBe(0);
  });

  it("rejects missing required fields and malformed mapped values", () => {
    expect(validateImportRow("companies", { name: "" }).success).toBe(false);
    expect(validateImportRow("leads", { fullName: "A lead", email: "bad", estimatedValue: "not-money" }).success).toBe(false);
  });
});

describe("CSV export serialization", () => {
  it("quotes fields and neutralizes spreadsheet formula prefixes", () => {
    expect(serializeCsv(["Name", "Notes", "Value"], [["Taylor, Reed", 'said "hello"', "=1+1"], ["@cmd", "next\nline", -3]])).toBe('"Name","Notes","Value"\r\n"Taylor, Reed","said ""hello""","\'=1+1"\r\n"\'@cmd","next\nline","\'-3"');
  });
});
