import { z } from "zod";

export const dealActivityInputSchema = z.object({
  type: z.enum(["call", "email", "meeting", "note"]),
  subject: z.string().trim().min(1, "Enter an activity subject.").max(200),
  body: z.string().trim().max(5000).optional().transform((value) => value || null),
  occurredAt: z.string().datetime({ offset: true }),
});

export const dealNoteInputSchema = z.object({
  body: z.string().trim().min(1, "Enter a note.").max(10000),
});

export const dealTaskInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(200),
  description: z.string().trim().max(5000).optional().transform((value) => value || null),
  type: z.enum(["call", "email", "meeting", "follow_up", "to_do"]),
  priority: z.enum(["low", "medium", "high"]),
  dueAt: z.string().datetime({ offset: true }),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null),
});
