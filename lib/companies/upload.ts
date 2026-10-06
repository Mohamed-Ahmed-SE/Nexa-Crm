const maxCompanyAttachmentBytes = 10 * 1024 * 1024;
const allowedExtensionsByMimeType = new Map<string, ReadonlySet<string>>([
  ["application/pdf", new Set(["pdf"])],
  ["text/plain", new Set(["txt"])],
  ["text/csv", new Set(["csv"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set(["docx"])],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Set(["xlsx"])],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", new Set(["pptx"])],
]);

type CompanyUploadCandidate = { name: string; type: string; size: number };
type CompanyUploadMetadata = { filename: string; mimeType: string };
type CompanyUploadMetadataResult = CompanyUploadMetadata | { message: string };

export function sanitizeCompanyFilename(originalFilename: string) {
  const normalized = originalFilename.normalize("NFKC").replace(/[\/\\\u0000-\u001f\u007f]/g, "_").replace(/[^a-zA-Z0-9 ._()-]/g, "_").trim().replace(/^\.+/, "");
  const segments = normalized.split(".");
  const extension = segments.length > 1 ? `.${segments.pop()}` : "";
  const basename = segments.join(".").slice(0, 240 - extension.length).trim() || "attachment";
  return `${basename}${extension}`;
}

export function validateCompanyUploadMetadata(file: CompanyUploadCandidate): CompanyUploadMetadataResult {
  if (file.size < 1) return { message: "Choose a file to upload." };
  if (file.size > maxCompanyAttachmentBytes) return { message: "Files must be 10 MB or smaller." };

  const filename = sanitizeCompanyFilename(file.name);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = allowedExtensionsByMimeType.get(file.type);
  if (!allowedExtensions?.has(extension)) return { message: "Use a PDF, text, CSV, DOCX, XLSX, or PPTX file." };
  return { filename, mimeType: file.type };
}

export function isValidCompanyUploadContent(bytes: Uint8Array, mimeType: string, expectedSize: number) {
  if (bytes.byteLength !== expectedSize || bytes.byteLength === 0 || !allowedExtensionsByMimeType.has(mimeType)) return false;
  if (mimeType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mimeType === "text/plain" || mimeType === "text/csv") return !bytes.subarray(0, 8192).some((byte) => byte === 0);
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
