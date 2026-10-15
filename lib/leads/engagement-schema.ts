import { z } from "zod";

export const leadActivityInputSchema = z.object({
  type: z.enum(["call", "email", "meeting", "note"]),
  subject: z.string().trim().min(1, "Enter an activity subject.").max(200),
  body: z.string().trim().max(5000).optional().transform((bodyText) => bodyText || null),
  occurredAt: z.string().datetime({ offset: true }),
});

export const leadNoteInputSchema = z.object({
  body: z.string().trim().min(1, "Enter a note.").max(10000),
});
