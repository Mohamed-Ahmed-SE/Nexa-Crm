import { describe, expect, it } from "vitest";
import { assertCsvWithinLimit, isImportPayloadWithinLimit, isWithinUtf8ByteLimit, MAX_CSV_BYTES, MAX_IMPORT_PAYLOAD_BYTES } from "@/lib/csv/limits";

describe("CSV import size limits", () => {
  it.each([
    ["fits exactly at the UTF-8 byte limit", "éé", 4, true],
    ["rejects multibyte text above the UTF-8 byte limit", "ééé", 4, false],
    ["accepts a string at the byte limit", "abcd", 4, true],
  ])("%s", (_scenario, value, limit, expected) => {
    expect(isWithinUtf8ByteLimit(value, limit)).toBe(expected);
  });

  it("accepts the advertised CSV size and rejects one byte over", () => {
    expect(() => assertCsvWithinLimit("a".repeat(MAX_CSV_BYTES))).not.toThrow();
    expect(() => assertCsvWithinLimit("a".repeat(MAX_CSV_BYTES + 1))).toThrow("CSV files must be 5 MB or smaller.");
  });

  it("counts serialized action payloads in UTF-8 bytes", () => {
    const acceptedPayload = "a".repeat(MAX_IMPORT_PAYLOAD_BYTES);
    const oversizedPayload = "é".repeat(MAX_IMPORT_PAYLOAD_BYTES / 2 + 1);

    expect(isImportPayloadWithinLimit(acceptedPayload)).toBe(true);
    expect(isImportPayloadWithinLimit(oversizedPayload)).toBe(false);
  });
});
