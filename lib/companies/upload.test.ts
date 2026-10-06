import { describe, expect, it } from "vitest";
import { isValidCompanyUploadContent, sanitizeCompanyFilename, validateCompanyUploadMetadata } from "@/lib/companies/upload";

const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
const textBytes = (text: string) => new TextEncoder().encode(text);
const upload = (label: string, name: string, type: string, bytes: Uint8Array) => ({ label, file: { name, type, size: bytes.byteLength }, bytes });

const validUploads = [
  upload("PDF", "report.pdf", "application/pdf", textBytes("%PDF-1.7")),
  upload("text", "readme.txt", "text/plain", textBytes("Company notes")),
  upload("CSV", "companies.csv", "text/csv", textBytes("name,industry\nAcme,Software")),
  upload("DOCX", "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zipHeader),
  upload("XLSX", "companies.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zipHeader),
  upload("PPTX", "presentation.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", zipHeader),
];

describe("company uploads", () => {
  it.each(validUploads)("accepts matching $label files", ({ file, bytes }) => {
    const metadata = validateCompanyUploadMetadata(file);

    expect(metadata).toEqual({ filename: file.name, mimeType: file.type });
    expect(isValidCompanyUploadContent(bytes, file.type, file.size)).toBe(true);
  });

  it.each([
    { name: "report.txt", type: "application/pdf" },
    { name: "report.xlsx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { name: "report.pdf", type: "text/plain" },
  ])("rejects mismatched MIME and extension: $type / $name", (file) => {
    expect("message" in validateCompanyUploadMetadata({ ...file, size: 10 })).toBe(true);
  });

  it.each([
    { label: "PDF signature", file: { name: "report.pdf", type: "application/pdf" }, bytes: textBytes("not a PDF") },
    { label: "text with binary NUL", file: { name: "readme.txt", type: "text/plain" }, bytes: new Uint8Array([0x41, 0x00]) },
    { label: "Office ZIP signature", file: { name: "report.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, bytes: textBytes("not a ZIP") },
  ])("rejects invalid $label", ({ file, bytes }) => {
    expect(isValidCompanyUploadContent(bytes, file.type, bytes.byteLength)).toBe(false);
  });

  it.each([
    { label: "empty", size: 0 },
    { label: "larger than 10 MB", size: 10 * 1024 * 1024 + 1 },
  ])("rejects $label files", ({ size }) => {
    expect("message" in validateCompanyUploadMetadata({ name: "report.pdf", type: "application/pdf", size })).toBe(true);
  });

  it("stores normalized filenames without path or control characters", () => {
    expect(sanitizeCompanyFilename("../Résumé/evil\u0000name.PDF")).toBe("_R_sum__evil_name.PDF");
  });
});
