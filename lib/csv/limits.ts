export const MAX_CSV_BYTES = 5_000_000;
export const MAX_IMPORT_PAYLOAD_BYTES = 32_000_000;

export function isWithinUtf8ByteLimit(value: string, limit: number): boolean {
  return new TextEncoder().encode(value).byteLength <= limit;
}

export function isImportPayloadWithinLimit(payload: string): boolean {
  return isWithinUtf8ByteLimit(payload, MAX_IMPORT_PAYLOAD_BYTES);
}

export function assertCsvWithinLimit(csv: string): void {
  if (!isWithinUtf8ByteLimit(csv, MAX_CSV_BYTES)) {
    throw new Error("CSV files must be 5 MB or smaller.");
  }
}
