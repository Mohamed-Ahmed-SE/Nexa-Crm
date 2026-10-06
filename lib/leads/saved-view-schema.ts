import { z } from "zod";

export const leadViewColumns = ["name", "company", "status", "source", "owner", "value", "updated"] as const;
export type LeadViewColumn = (typeof leadViewColumns)[number];

export const leadViewSorts = [
  "updated_desc", "updated_asc", "name_asc", "name_desc", "value_asc", "value_desc",
] as const;
export type LeadViewSort = (typeof leadViewSorts)[number];

const leadFiltersSchema = z.object({
  q: z.string().trim().max(100),
  status: z.enum(["all", "new", "contacted", "qualified", "unqualified", "converted"]),
  sourceId: z.union([z.string().uuid(), z.literal("")]),
  ownerId: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]),
}).strict();

export const leadSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: leadFiltersSchema,
  sort: z.enum(leadViewSorts),
  visibleColumns: z.array(z.enum(leadViewColumns)).min(1).max(leadViewColumns.length).refine((columns) => new Set(columns).size === columns.length),
}).strict();

export type LeadSavedViewInput = z.infer<typeof leadSavedViewSchema>;

export const leadSavedViewIdSchema = z.string().uuid();

export function parsePersistedLeadView(input: { filters: unknown; sort: unknown; visible_columns: unknown }) {
  const parsed = leadSavedViewSchema.safeParse({
    name: "Saved view",
    filters: input.filters,
    sort: input.sort,
    visibleColumns: input.visible_columns,
  });
  if (!parsed.success) return null;
  return { filters: parsed.data.filters, sort: parsed.data.sort, visibleColumns: parsed.data.visibleColumns };
}
