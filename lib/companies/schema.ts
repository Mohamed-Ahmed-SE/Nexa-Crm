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

const companySearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  owner: z.union([z.string().uuid(), z.literal(""), z.literal("unassigned")]).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CompanySearchParams = { q: string; ownerId: string; page: number };

export function parseCompanySearchParams(input: Record<string, string | string[] | undefined>): CompanySearchParams {
  const parsed = companySearchSchema.safeParse({
    q: typeof input.q === "string" ? input.q : "",
    owner: typeof input.owner === "string" ? input.owner : "",
    page: typeof input.page === "string" ? input.page : "1",
  });
  return parsed.success
    ? { q: parsed.data.q, ownerId: parsed.data.owner, page: parsed.data.page }
    : { q: "", ownerId: "", page: 1 };
}

export function escapeCompanySearchTerm(query: string): string {
  return query.trim().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll('"', '\\"');
}

export function buildCompanySearchFilter(query: string): string | null {
  if (!query.trim()) return null;
  const pattern = `"%${escapeCompanySearchTerm(query)}%"`;
  return [`name.ilike.${pattern}`, `industry.ilike.${pattern}`, `website.ilike.${pattern}`, `phone.ilike.${pattern}`].join(",");
}
