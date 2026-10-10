import { z } from "zod";

export const contactLifecycleStatuses = ["active", "inactive", "customer", "former_customer"] as const;
export type ContactLifecycleStatus = (typeof contactLifecycleStatuses)[number];
export const lifecycleLabels: Record<ContactLifecycleStatus, string> = {
  active: "Active", inactive: "Inactive", customer: "Customer", former_customer: "Former customer",
};

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

export const contactViewColumns = ["name", "company", "job_title", "email", "phone", "owner", "lifecycle", "last_activity", "next_activity", "tags"] as const;
export type ContactViewColumn = (typeof contactViewColumns)[number];
export const contactViewSorts = ["updated_desc", "updated_asc", "created_desc", "created_asc", "name_asc", "name_desc"] as const;
export type ContactViewSort = (typeof contactViewSorts)[number];
export type ContactSortOrder = { column: "first_name" | "last_name" | "created_at" | "updated_at" | "id"; ascending: boolean };

export function contactSortOrder(sort: ContactViewSort): ContactSortOrder[] {
  let primaryOrder: ContactSortOrder[];
  if (sort.startsWith("name_")) {
    const ascending = sort === "name_asc";
    primaryOrder = [{ column: "first_name", ascending }, { column: "last_name", ascending }];
  } else {
    const column = sort.startsWith("created_") ? "created_at" : "updated_at";
    primaryOrder = [{ column, ascending: sort.endsWith("_asc") }];
  }
  return [...primaryOrder, { column: "id", ascending: true }];
}

const contactViewFiltersSchema = z.object({
  q: z.string().trim().max(100),
  lifecycle: z.enum(["all", ...contactLifecycleStatuses]),
  companyId: z.union([z.string().uuid(), z.literal("")]),
  ownerId: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]),
}).strict();

export const contactSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: contactViewFiltersSchema,
  sort: z.enum(contactViewSorts),
  visibleColumns: z.array(z.enum(contactViewColumns)).min(1).max(contactViewColumns.length)
    .refine((columns) => new Set(columns).size === columns.length),
}).strict();
export type ContactSavedViewInput = z.infer<typeof contactSavedViewSchema>;

export function applyContactSavedView(params: ContactSearchParams, view: Pick<ContactSavedViewInput, "filters" | "sort">): ContactSearchParams {
  return { ...params, ...view.filters, sort: view.sort };
}

export const contactSavedViewIdSchema = z.string().uuid();

export function parsePersistedContactView(input: { filters: unknown; sort: unknown; visible_columns: unknown }) {
  const parsed = contactSavedViewSchema.safeParse({
    name: "Saved view", filters: input.filters, sort: input.sort, visibleColumns: input.visible_columns,
  });
  return parsed.success ? { filters: parsed.data.filters, sort: parsed.data.sort, visibleColumns: parsed.data.visibleColumns } : null;
}

const searchParamsSchema = z.object({
  q: z.string().trim().max(100).default(""),
  lifecycle: z.enum(["all", ...contactLifecycleStatuses]).default("all"),
  company: z.union([z.string().uuid(), z.literal("")]).default(""),
  owner: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]).default(""),
  sort: z.enum(contactViewSorts).default("updated_desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type ContactSearchParams = { q: string; lifecycle: ContactLifecycleStatus | "all"; companyId: string; ownerId: string; sort: ContactViewSort; page: number };

export function parseContactSearchParams(input: Record<string, string | string[] | undefined>): ContactSearchParams {
  const searchParams = searchParamsSchema.safeParse({
    q: typeof input.q === "string" ? input.q : "",
    lifecycle: typeof input.lifecycle === "string" ? input.lifecycle : "all",
    company: typeof input.company === "string" ? input.company : "",
    owner: typeof input.owner === "string" ? input.owner : "",
    sort: typeof input.sort === "string" ? input.sort : "updated_desc",
    page: typeof input.page === "string" ? input.page : "1",
  });
  if (!searchParams.success) return { q: "", lifecycle: "all", companyId: "", ownerId: "", sort: "updated_desc", page: 1 };
  return { q: searchParams.data.q, lifecycle: searchParams.data.lifecycle, companyId: searchParams.data.company, ownerId: searchParams.data.owner, sort: searchParams.data.sort, page: searchParams.data.page };
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
