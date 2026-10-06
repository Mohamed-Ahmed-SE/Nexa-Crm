import { z } from "zod";

export const contactLifecycleStatuses = ["active", "inactive", "customer", "former_customer"] as const;
export type ContactLifecycleStatus = (typeof contactLifecycleStatuses)[number];

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((optionalTextValue) => optionalTextValue || null);
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional().transform((uuidInput) => uuidInput || null);

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export const contactInputSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().transform((emailAddress) => emailAddress || null),
  phone: optionalText(50),
  jobTitle: optionalText(150),
  companyId: optionalUuid,
  ownerId: optionalUuid,
  lifecycleStatus: z.enum(contactLifecycleStatuses),
  linkedinUrl: z.union([z.string().trim().url().max(2048).refine((linkedinUrl) => isHttpsUrl(linkedinUrl), "Enter an HTTPS URL."), z.literal("")]).optional().transform((linkedinUrl) => linkedinUrl || null),
});
export type ContactInput = z.infer<typeof contactInputSchema>;

export const contactIdSchema = z.string().uuid();

const searchParamsSchema = z.object({
  q: z.string().trim().max(100).default(""),
  lifecycle: z.enum(["all", ...contactLifecycleStatuses]).default("all"),
  company: z.union([z.string().uuid(), z.literal("")]).default(""),
  owner: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type ContactSearchParams = { q: string; lifecycle: ContactLifecycleStatus | "all"; companyId: string; ownerId: string; page: number };

export function parseContactSearchParams(input: Record<string, string | string[] | undefined>): ContactSearchParams {
  const searchParams = searchParamsSchema.safeParse({
    q: typeof input.q === "string" ? input.q : "",
    lifecycle: typeof input.lifecycle === "string" ? input.lifecycle : "all",
    company: typeof input.company === "string" ? input.company : "",
    owner: typeof input.owner === "string" ? input.owner : "",
    page: typeof input.page === "string" ? input.page : "1",
  });
  if (!searchParams.success) return { q: "", lifecycle: "all", companyId: "", ownerId: "", page: 1 };
  return { q: searchParams.data.q, lifecycle: searchParams.data.lifecycle, companyId: searchParams.data.company, ownerId: searchParams.data.owner, page: searchParams.data.page };
}

export function escapeContactSearchTerm(query: string): string {
  return query.trim().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function buildContactSearchFilter(query: string): string | null {
  const searchTerm = query.trim();
  if (!searchTerm) return null;
  const escapedSearchTerm = escapeContactSearchTerm(searchTerm).replaceAll('"', '\\"');
  const ilikePattern = `"%${escapedSearchTerm}%"`;
  return [`first_name.ilike.${ilikePattern}`, `last_name.ilike.${ilikePattern}`, `email.ilike.${ilikePattern}`, `phone.ilike.${ilikePattern}`, `job_title.ilike.${ilikePattern}`].join(",");
}

export const contactPageSize = 25;
