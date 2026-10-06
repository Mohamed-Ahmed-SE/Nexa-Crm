import { z } from "zod";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const dealInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a deal name.").max(200),
  companyId: optionalUuid,
  contactId: optionalUuid,
  amount: z.coerce.number().finite().min(0).max(999999999999.99),
  expectedCloseDate: z.union([z.string().date(), z.literal("")]).optional().transform((value) => value || null),
  ownerId: optionalUuid,
  priority: z.enum(["low", "medium", "high"]),
  description: optionalText(2000),
  pipelineId: z.string().uuid("Choose a pipeline."),
});
export type DealInput = z.infer<typeof dealInputSchema>;

export const dealIdSchema = z.string().uuid();
export const pipelineIdSchema = z.string().uuid();
export const stageIdSchema = z.string().uuid();
const outcomeNote = z.string().trim().max(2000).optional().transform((value) => value || null);
export const wonDealOutcomeSchema = z.object({ id: dealIdSchema, amount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).transform(Number).pipe(z.number().finite().min(0).max(999999999999.99)), wonDate: z.string().date(), note: outcomeNote });
export const lostDealOutcomeSchema = z.object({ id: dealIdSchema, lostReasonId: z.string().uuid(), competitor: z.string().trim().max(200).optional().transform((value) => value || null), note: outcomeNote, taskChoice: z.enum(["keep", "complete", "cancel"]) });
export const reopenDealOutcomeSchema = z.object({ id: dealIdSchema, stageId: stageIdSchema });

export type DealSearchParams = { q: string; ownerId: string; pipelineId: string };

export function parseDealSearchParams(input: Record<string, string | string[] | undefined>): DealSearchParams {
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 100) : "";
  const ownerId = typeof input.owner === "string" && (input.owner === "unassigned" || z.string().uuid().safeParse(input.owner).success) ? input.owner : "";
  const pipelineId = typeof input.pipeline === "string" && z.string().uuid().safeParse(input.pipeline).success ? input.pipeline : "";
  return { q, ownerId, pipelineId };
}

export function buildDealSearchFilter(query: string): string | null {
  const term = query.trim();
  if (!term) return null;
  const escaped = term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll('"', '\\"');
  return `title.ilike."%${escaped}%"`;
}
