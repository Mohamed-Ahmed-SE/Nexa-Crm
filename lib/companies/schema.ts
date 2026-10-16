import { z } from "zod";

const blankableText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null);

export const companyIdSchema = z.string().uuid();
export const companyPageSize = 25;
export const companyInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a company name.").max(200),
  website: z.union([z.string().trim().url().max(2048).refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS website URL."), z.literal("")]).optional().transform((value) => value || null),
  industry: blankableText(100),
  employeeSize: z.union([z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(100_000_000)), z.literal("")]).optional().transform((value) => value === "" || value === undefined ? null : value),
  phone: blankableText(50),
  addressLine1: blankableText(200),
  addressLine2: blankableText(200),
  city: blankableText(100),
  state: blankableText(100),
  postalCode: blankableText(30),
  country: blankableText(100),
  description: blankableText(5000),
  ownerId: optionalUuid,
  tagIds: z.array(z.string().uuid("Choose valid tags.")).max(100, "Choose no more than 100 tags.").refine((tagIds) => new Set(tagIds).size === tagIds.length, "Each tag can be selected only once.").default([]),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const companyActivityInputSchema = z.object({
  type: z.enum(["call", "email", "meeting", "note"]),
  subject: z.string().trim().min(1).max(200),
  body: blankableText(5000),
  occurredAt: z.string().datetime({ offset: true }),
});
export const companyNoteSchema = z.object({ body: z.string().trim().min(1, "Enter a note.").max(10000) });
export const companyTaskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(200),
  description: blankableText(5000),
  type: z.enum(["call", "email", "meeting", "follow_up", "to_do"]),
  priority: z.enum(["low", "medium", "high"]),
  dueAt: z.string().datetime({ offset: true }),
  assignedTo: optionalUuid,
});

export const companyViewColumns = ["company", "industry", "contacts", "open_deals", "pipeline_value", "owner", "last_activity", "next_activity", "tags"] as const;
export type CompanyViewColumn = (typeof companyViewColumns)[number];
export const companyViewSorts = ["name_asc", "name_desc", "industry_asc", "industry_desc", "created_desc", "created_asc", "updated_desc", "updated_asc"] as const;
export type CompanyViewSort = (typeof companyViewSorts)[number];
export type CompanySortOrder = { column: "name" | "industry" | "created_at" | "updated_at" | "id"; ascending: boolean };

export function companySortOrder(sort: CompanyViewSort): CompanySortOrder[] {
  const ascending = sort.endsWith("_asc");
  const column = sort.startsWith("name_") ? "name" : sort.startsWith("industry_") ? "industry" : sort.startsWith("created_") ? "created_at" : "updated_at";
  return [{ column, ascending }, { column: "id", ascending: true }];
}

const companyViewFiltersSchema = z.object({
  q: z.string().trim().max(100),
  ownerId: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]),
}).strict();

export const companySavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: companyViewFiltersSchema,
  sort: z.enum(companyViewSorts),
  visibleColumns: z.array(z.enum(companyViewColumns)).min(1).max(companyViewColumns.length)
    .refine((columns) => new Set(columns).size === columns.length),
}).strict();
export type CompanySavedViewInput = z.infer<typeof companySavedViewSchema>;

export function applyCompanySavedView(params: CompanySearchParams, view: Pick<CompanySavedViewInput, "filters" | "sort">): CompanySearchParams {
  return { ...params, ...view.filters, sort: view.sort };
}

export const companySavedViewIdSchema = z.string().uuid();

export function findCompanySavedView<T extends { id: string }>(input: unknown, views: T[]): T | undefined {
  const id = companySavedViewIdSchema.safeParse(input);
  return id.success ? views.find((view) => view.id === id.data) : undefined;
}

export function parsePersistedCompanyView(input: { filters: unknown; sort: unknown; visible_columns: unknown }) {
  const parsed = companySavedViewSchema.safeParse({
    name: "Saved view", filters: input.filters, sort: input.sort, visibleColumns: input.visible_columns,
  });
  return parsed.success ? { filters: parsed.data.filters, sort: parsed.data.sort, visibleColumns: parsed.data.visibleColumns } : null;
}

const companySearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  owner: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]).default(""),
  tagId: z.union([z.string().uuid(), z.literal("")]).default(""),
  sort: z.enum(companyViewSorts).default("name_asc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CompanySearchParams = { q: string; ownerId: string; tagId: string; sort: CompanyViewSort; page: number };

export function parseCompanySearchParams(input: Record<string, string | string[] | undefined>): CompanySearchParams {
  const parsed = companySearchSchema.safeParse({
    q: typeof input.q === "string" ? input.q : "",
    owner: typeof input.owner === "string" ? input.owner : "",
    tagId: typeof input.tagId === "string" ? input.tagId : "",
    sort: typeof input.sort === "string" ? input.sort : "name_asc",
    page: typeof input.page === "string" ? input.page : "1",
  });
  return parsed.success
    ? { q: parsed.data.q, ownerId: parsed.data.owner, tagId: parsed.data.tagId, sort: parsed.data.sort, page: parsed.data.page }
    : { q: "", ownerId: "", tagId: "", sort: "name_asc", page: 1 };
}

export function escapeCompanySearchTerm(query: string): string {
  return query.trim().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll('"', '\\"');
}

export function buildCompanySearchFilter(query: string): string | null {
  if (!query.trim()) return null;
  const pattern = `"%${escapeCompanySearchTerm(query)}%"`;
  return [`name.ilike.${pattern}`, `industry.ilike.${pattern}`, `website.ilike.${pattern}`, `phone.ilike.${pattern}`].join(",");
}
