import { companyInputSchema } from "@/lib/companies/schema";
import { contactInputSchema } from "@/lib/contacts/schema";
import { leadInputSchema } from "@/lib/leads/schema";

export const importEntities = ["leads", "contacts", "companies"] as const;
export type ImportEntity = (typeof importEntities)[number];
export type ImportField = { key: string; label: string; required?: boolean };

export const importFields: Record<ImportEntity, ImportField[]> = {
  leads: [
    { key: "fullName", label: "Name", required: true }, { key: "companyName", label: "Company" }, { key: "email", label: "Email" },
    { key: "phone", label: "Phone" }, { key: "jobTitle", label: "Job title" }, { key: "source", label: "Lead source" },
    { key: "status", label: "Status" }, { key: "estimatedValue", label: "Estimated value" }, { key: "ownerId", label: "Owner ID" }, { key: "notesSummary", label: "Notes" },
  ],
  contacts: [
    { key: "firstName", label: "First name", required: true }, { key: "lastName", label: "Last name", required: true }, { key: "email", label: "Email" },
    { key: "phone", label: "Phone" }, { key: "jobTitle", label: "Job title" }, { key: "company", label: "Company" }, { key: "lifecycleStatus", label: "Lifecycle" },
    { key: "linkedinUrl", label: "LinkedIn URL" }, { key: "ownerId", label: "Owner ID" },
  ],
  companies: [
    { key: "name", label: "Company name", required: true }, { key: "website", label: "Website" }, { key: "industry", label: "Industry" },
    { key: "employeeSize", label: "Employee size" }, { key: "phone", label: "Phone" }, { key: "addressLine1", label: "Address line 1" },
    { key: "addressLine2", label: "Address line 2" }, { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "postalCode", label: "Postal code" },
    { key: "country", label: "Country" }, { key: "description", label: "Description" }, { key: "ownerId", label: "Owner ID" },
  ],
};

export const importSchemas = { leads: leadInputSchema, contacts: contactInputSchema, companies: companyInputSchema };

export function suggestedMappings(entity: ImportEntity, headers: string[]) {
  const normalize = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string[]> = {
    fullName: ["name", "fullname", "leadname"], companyName: ["company", "companyname"], name: ["name", "companyname", "organization", "organizationname"], firstName: ["firstname"], lastName: ["lastname"],
    jobTitle: ["jobtitle", "title"], estimatedValue: ["estimatedvalue", "value"], lifecycleStatus: ["lifecycle", "status"],
    employeeSize: ["employeesize", "employees"], addressLine1: ["address", "addressline1"], addressLine2: ["addressline2"],
    postalCode: ["postalcode", "zip", "zipcode"], notesSummary: ["notes", "notessummary"], linkedinUrl: ["linkedin", "linkedinurl"],
    ownerId: ["ownerid"], source: ["source", "leadsource"], company: ["company", "companyname"],
  };
  return importFields[entity].map((field) => {
    const columnIndex = headers.findIndex((header) => (aliases[field.key] ?? [field.key]).includes(normalize(header)));
    return columnIndex;
  });
}

export function mappedCsvRow(headers: string[], row: string[], mapping: number[], entity: ImportEntity) {
  const mapped = Object.fromEntries(importFields[entity].map((field, fieldIndex) => [field.key, mapping[fieldIndex] < 0 ? "" : row[mapping[fieldIndex]] ?? ""]));
  for (const [key, value] of Object.entries(mapped)) if (typeof value === "string") mapped[key] = value.trim();
  return mapped;
}

export function prepareImportRow(entity: ImportEntity, row: Record<string, unknown>) {
  const cleaned = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
  if (entity === "leads" && !cleaned.status) cleaned.status = "new";
  if (entity === "contacts" && !cleaned.lifecycleStatus) cleaned.lifecycleStatus = "active";
  return cleaned;
}

export function validateImportRow(entity: ImportEntity, row: Record<string, unknown>) {
  return importSchemas[entity].safeParse(prepareImportRow(entity, row));
}
