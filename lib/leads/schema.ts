import { z } from "zod";

export const leadStatuses = ["new", "contacted", "qualified", "unqualified"] as const;
export type LeadStatus = (typeof leadStatuses)[number];
export type LeadFilterStatus = LeadStatus | "converted";
export const statusLabels: Record<LeadFilterStatus, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", unqualified: "Unqualified", converted: "Converted",
};

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null);

export const leadInputSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a lead name.").max(200),
  companyName: optionalText(200),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().transform((value) => value || null),
  phone: optionalText(50),
  jobTitle: optionalText(150),
  sourceId: optionalUuid,
  status: z.enum(leadStatuses),
  ownerId: optionalUuid,
  estimatedValue: z.coerce.number().finite().min(0).max(999999999999.99),
  notesSummary: optionalText(2000),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const leadIdSchema = z.string().uuid();
export const bulkLeadIdsSchema = z.array(leadIdSchema).min(1).max(25).refine((ids) => new Set(ids).size === ids.length, "Lead selections must not contain duplicates.");
export const bulkLeadTagSchema = z.object({ leadIds: bulkLeadIdsSchema, tagId: z.string().uuid() });

export type LeadSearchParams = {
  q: string;
  status: LeadFilterStatus | "all";
  sourceId: string;
  ownerId: string;
  tagId: string;
  page: number;
  sort: "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "value_asc" | "value_desc";
};

const searchParamsSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", ...leadStatuses, "converted"]).default("all"),
  source: z.union([z.string().uuid(), z.literal("")]).default(""),
  owner: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]).default(""),
  tagId: z.union([z.string().uuid(), z.literal("")]).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  sort: z.enum(["updated_desc", "updated_asc", "name_asc", "name_desc", "value_asc", "value_desc"]).default("updated_desc"),
});

export function parseLeadSearchParams(input: Record<string, string | string[] | undefined>): LeadSearchParams {
  const parsed = searchParamsSchema.safeParse({
    q: typeof input.q === "string" ? input.q : "",
    status: typeof input.status === "string" ? input.status : "all",
    source: typeof input.source === "string" ? input.source : "",
    owner: typeof input.owner === "string" ? input.owner : "",
    tagId: typeof input.tagId === "string" ? input.tagId : "",
    page: typeof input.page === "string" ? input.page : "1",
    sort: typeof input.sort === "string" ? input.sort : "updated_desc",
  });
  if (!parsed.success) return { q: "", status: "all", sourceId: "", ownerId: "", tagId: "", page: 1, sort: "updated_desc" };
  return { q: parsed.data.q, status: parsed.data.status, sourceId: parsed.data.source, ownerId: parsed.data.owner, tagId: parsed.data.tagId, page: parsed.data.page, sort: parsed.data.sort };
}

export function buildLeadSearchFilter(query: string): string | null {
  const term = query.trim();
  if (!term) return null;
  const escaped = term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll('"', '\\"');
  const value = `"%${escaped}%"`;
  return [`full_name.ilike.${value}`, `company_name.ilike.${value}`, `email.ilike.${value}`].join(",");
}

export const leadPageSize = 25;
