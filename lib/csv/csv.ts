import { assertCsvWithinLimit } from "@/lib/csv/limits";

export type CsvParseResult = { headers: string[]; rows: string[][] };

const MAX_CSV_DATA_ROWS = 10_000;

export function parseCsv(text: string): CsvParseResult {
  assertCsvWithinLimit(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  const finishField = () => { record.push(field); field = ""; afterQuote = false; };
  const finishRecord = () => {
    finishField();
    records.push(record);
    if (records.length - 1 > MAX_CSV_DATA_ROWS) throw new Error("CSV files may contain at most 10,000 rows.");
    record = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') { quoted = false; afterQuote = true; }
      else field += character;
    } else if (afterQuote) {
      if (character === ",") finishField();
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        finishRecord();
      } else throw new Error("Unexpected text after a quoted CSV field.");
    } else if (character === '"') {
      if (field.length) throw new Error("A quote may only begin at the start of a CSV field.");
      quoted = true;
    } else if (character === ",") finishField();
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      finishRecord();
    } else field += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (field || record.length || afterQuote) finishRecord();
  const [headers = [], ...parsedRows] = records;
  if (!headers.length || headers.length > 200 || headers.every((header) => !header.trim())) throw new Error("Add a header row with up to 200 columns.");
  const normalizedHeaders = headers.map((header) => header.trim());
  if (new Set(normalizedHeaders.map((header) => header.toLowerCase())).size !== normalizedHeaders.length) throw new Error("Column headers must be unique.");
  const malformedRow = parsedRows.findIndex((row) => row.some((cell) => cell.trim()) && row.length !== headers.length);
  if (malformedRow >= 0) throw new Error(`CSV row ${malformedRow + 2} has a different number of columns than the header.`);
  return { headers: normalizedHeaders, rows: parsedRows.filter((row) => row.some((cell) => cell.trim())) };
}

export function serializeCsv(headers: string[], rows: unknown[][]): string {
  const quoteCell = (value: unknown) => {
    let cell = value === null || value === undefined ? "" : String(value);
    if (/^[\t\r\n ]*[=+@-]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  };
  return [headers, ...rows].map((row) => row.map(quoteCell).join(",")).join("\r\n");
}
