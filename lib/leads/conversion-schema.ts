import { z } from "zod";

const uuidOrEmpty = z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null);
const boundedName = (max: number) => z.string().trim().max(max);
const validDealValue = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/).transform(Number)
  .pipe(z.number().finite().min(0).max(999999999999.99));

export const leadConversionSchema = z.object({
  createContact: z.boolean(),
  createCompany: z.boolean(),
  createDeal: z.boolean(),
  contactFirstName: boundedName(100),
  contactLastName: boundedName(100),
  companyName: boundedName(200),
  dealTitle: boundedName(200),
  pipelineId: uuidOrEmpty,
  stageId: uuidOrEmpty,
  dealOwnerId: uuidOrEmpty,
  dealValue: z.string().trim(),
  closeDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .transform((value) => value || null)
    .refine((value) => {
      if (!value) return true;
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }),
}).superRefine((input, context) => {
  if (!input.createContact && !input.createCompany && !input.createDeal) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["createContact"], message: "Choose at least one record to create." });
  }
  if (input.createContact && (!input.contactFirstName || !input.contactLastName)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["contactFirstName"], message: "Enter both contact names." });
  }
  if (input.createCompany && !input.companyName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "Enter a company name." });
  }
  if (input.createDeal && (!input.dealTitle || !input.pipelineId || !input.stageId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dealTitle"], message: "Enter a deal title and choose its pipeline stage." });
  }
  if (input.createDeal && !validDealValue.safeParse(input.dealValue).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dealValue"], message: "Enter a valid non-negative deal value." });
  }
  if (input.createDeal && !input.dealOwnerId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dealOwnerId"], message: "Choose an owner for the deal." });
  }
}).transform((input) => ({
  ...input,
  dealValue: input.createDeal ? Number(input.dealValue) : null,
}));

export const leadConversionResultSchema = z.object({
  contactId: z.string().uuid().nullable(),
  companyId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
}).refine(({ contactId, companyId, dealId }) => Boolean(contactId || companyId || dealId));

export type LeadConversionInput = z.infer<typeof leadConversionSchema>;
export type LeadConversionResult = z.infer<typeof leadConversionResultSchema>;
