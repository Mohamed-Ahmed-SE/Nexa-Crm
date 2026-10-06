import { z } from "zod";
import { importEntities } from "@/lib/csv/import";

const importRowErrorSchema = z.object({
  row: z.number().int().min(2).max(10_001),
  errors: z.array(z.string().min(1)).min(1),
}).strict();

const importJobSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  entity: z.enum(importEntities),
  status: z.enum(["completed", "completed_with_errors", "failed"]),
  total_rows: z.number().int().min(0).max(10_000),
  imported_rows: z.number().int().min(0),
  rejected_rows: z.number().int().min(0),
}).strict().superRefine((job, context) => {
  if (job.imported_rows + job.rejected_rows !== job.total_rows) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Import history counts do not match the saved summary." });
  }
  if (!statusMatchesCounts(job)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Import history status does not match the saved counts." });
  }
});

export type ImportJobHistory = z.infer<typeof importJobSchema>;
export type ImportRowError = z.infer<typeof importRowErrorSchema>;

export function parseImportHistory(historyRows: unknown): ImportJobHistory[] | null {
  const result = z.array(importJobSchema).safeParse(historyRows);
  return result.success ? result.data : null;
}

export function parseImportRowErrors(rowErrors: unknown, rejectedRows: number): ImportRowError[] | null {
  const result = z.array(importRowErrorSchema).max(10_000).safeParse(rowErrors);
  if (!result.success || result.data.length !== rejectedRows) return null;
  if (new Set(result.data.map((rowError) => rowError.row)).size !== result.data.length) return null;
  return result.data;
}

function statusMatchesCounts(job: ImportJobHistory): boolean {
  if (job.status === "completed") return job.rejected_rows === 0;
  if (job.status === "completed_with_errors") return job.imported_rows > 0 && job.rejected_rows > 0;
  return job.imported_rows === 0 && job.rejected_rows > 0;
}
