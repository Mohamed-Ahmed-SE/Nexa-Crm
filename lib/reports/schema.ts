import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const uuid = z.string().uuid();
const reportInput = z.object({ start: isoDate.optional(), end: isoDate.optional(), owner: uuid.optional(), pipeline: uuid.optional() });

export type ReportFilters = { start: string; end: string; ownerId: string; pipelineId: string; invalid: boolean };

export function parseReportFilters(raw: Record<string, string | string[] | undefined>, now = new Date()): ReportFilters {
  const parsed = reportInput.safeParse({
    start: raw.start,
    end: raw.end,
    owner: raw.owner === "all" ? undefined : raw.owner,
    pipeline: raw.pipeline === "all" ? undefined : raw.pipeline,
  });
  const defaultEnd = now.toISOString().slice(0, 10);
  const defaultStartDate = new Date(`${defaultEnd}T00:00:00.000Z`);
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 89);
  const values = parsed.success ? parsed.data : {};
  const start = values.start ?? defaultStartDate.toISOString().slice(0, 10);
  const end = values.end ?? defaultEnd;
  const validOrder = start <= end;
  const validSpan = (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000 < 366;
  const rangeValid = validOrder && validSpan;
  return {
    start: rangeValid ? start : defaultStartDate.toISOString().slice(0, 10),
    end: rangeValid ? end : defaultEnd,
    ownerId: parsed.success ? parsed.data.owner ?? "all" : "all",
    pipelineId: parsed.success ? parsed.data.pipeline ?? "all" : "all",
    invalid: !parsed.success || !rangeValid,
  };
}

export function nextUtcDate(date: string) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString();
}
