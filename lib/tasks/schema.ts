import { z } from "zod";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";

export const taskViews = ["my", "today", "upcoming", "overdue", "completed"] as const;
export type TaskView = (typeof taskViews)[number];
export const taskTypes = ["call", "email", "meeting", "follow_up", "to_do"] as const;
export const taskPriorities = ["low", "medium", "high"] as const;
export const taskRelations = ["company", "contact", "lead", "deal"] as const;

const paramsSchema = z.object({
  view: z.enum(taskViews).default("my"),
  q: z.string().trim().max(100).default(""),
  priority: z.enum(["all", ...taskPriorities]).default("all"),
  type: z.enum(["all", ...taskTypes]).default("all"),
  timezoneOffset: z.number().int().min(-840).max(840).catch(0),
  tomorrowTimezoneOffset: z.number().int().min(-840).max(840).catch(0),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type TaskSearchParams = z.infer<typeof paramsSchema>;

export function parseTaskSearchParams(input: Record<string, string | string[] | undefined>): TaskSearchParams {
  const parsed = paramsSchema.safeParse({
    view: typeof input.view === "string" ? input.view : "my",
    q: typeof input.q === "string" ? input.q : "",
    priority: typeof input.priority === "string" ? input.priority : "all",
    type: typeof input.type === "string" ? input.type : "all",
    timezoneOffset: typeof input.timezoneOffset === "string" ? Number(input.timezoneOffset) : 0,
    tomorrowTimezoneOffset: typeof input.tomorrowTimezoneOffset === "string" ? Number(input.tomorrowTimezoneOffset) : 0,
    page: typeof input.page === "string" ? input.page : "1",
  });
  return parsed.success ? parsed.data : { view: "my", q: "", priority: "all", type: "all", timezoneOffset: 0, tomorrowTimezoneOffset: 0, page: 1 };
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(200),
  description: z.string().trim().max(5000).optional().transform((value) => value || null),
  type: z.enum(taskTypes),
  priority: z.enum(taskPriorities),
  dueAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().transform((value) => value || null),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null),
  relatedType: z.union([z.enum(taskRelations), z.literal("")]).optional().transform((value) => value || null),
  relatedId: z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null),
}).refine((value) => (value.relatedType === null) === (value.relatedId === null), {
  message: "Choose both a related record type and record.", path: ["relatedId"],
});

const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid due date and time.").refine((dueAt) => {
  const parsedDate = new Date(`${dueAt}:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 16) === dueAt;
}, "Enter a valid due date and time.");

export const rescheduleTaskSchema = z.object({
  dueAt: localDateTimeSchema,
  timezoneOffset: z.string().regex(/^-?\d+$/, "Your timezone could not be read.").transform(Number).pipe(z.number().int().min(-840).max(840)),
  timeZone: z.string().trim().min(1).max(100).refine(isValidTimeZone, "Your timezone could not be read."),
}).refine(({ dueAt, timezoneOffset, timeZone }) => matchesLocalDateTime(dueAt, timezoneOffset, timeZone), {
  message: "This local time does not exist in your timezone. Choose another time.", path: ["dueAt"],
}).transform(({ dueAt, timezoneOffset }) => ({ dueAt: normalizeContactDateTime(dueAt, String(timezoneOffset)) }))
  .pipe(z.object({ dueAt: z.string().datetime({ offset: true }) }));

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function matchesLocalDateTime(dueAt: string, timezoneOffset: number, timeZone: string) {
  const utcDate = new Date(`${dueAt}:00.000Z`);
  if (Number.isNaN(utcDate.getTime()) || utcDate.toISOString().slice(0, 16) !== dueAt) return true;
  const candidate = new Date(utcDate.getTime() + timezoneOffset * 60_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(candidate);
  const localParts = Object.fromEntries(parts.filter(({ type }) => ["year", "month", "day", "hour", "minute"].includes(type)).map(({ type, value }) => [type, value]));
  return `${localParts.year}-${localParts.month}-${localParts.day}T${localParts.hour}:${localParts.minute}` === dueAt;
}

export const taskIdSchema = z.string().uuid();
export const taskPageSize = 25;

export function escapeTaskSearchTerm(query: string): string {
  return query.trim().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll('"', '\\"');
}

export function taskDateBounds(now: Date, timezoneOffset: number, tomorrowTimezoneOffset = timezoneOffset) {
  const localNow = new Date(now.getTime() - timezoneOffset * 60_000);
  const [year, month, day] = localNow.toISOString().slice(0, 10).split("-").map(Number);
  const start = Date.UTC(year, month - 1, day) + timezoneOffset * 60_000;
  const tomorrow = Date.UTC(year, month - 1, day + 1) + tomorrowTimezoneOffset * 60_000;
  return { start: new Date(start), tomorrow: new Date(tomorrow) };
}

