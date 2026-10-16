import { z } from "zod";
import { normalizeContactDateTime } from "@/lib/contacts/date-time";

export const taskViews = ["my", "today", "tomorrow", "upcoming", "overdue", "completed", "cancelled", "all"] as const;
export type TaskView = (typeof taskViews)[number];
export const taskTypes = ["call", "email", "meeting", "follow_up", "to_do"] as const;
export const taskPriorities = ["low", "medium", "high"] as const;
export const taskSortOrders = ["due_date", "title"] as const;
export const taskRelations = ["company", "contact", "lead", "deal"] as const;

const paramsSchema = z.object({
  view: z.enum(taskViews).default("my"),
  q: z.string().trim().max(100).default(""),
  priority: z.enum(["all", ...taskPriorities]).default("all"),
  type: z.enum(["all", ...taskTypes]).default("all"),
  sort: z.enum(taskSortOrders).default("due_date"),
  timezoneOffset: z.number().int().min(-840).max(840).catch(0),
  tomorrowTimezoneOffset: z.number().int().min(-840).max(840).catch(0),
  weekStartTimezoneOffset: z.number().int().min(-840).max(840).catch(0),
  nextWeekTimezoneOffset: z.number().int().min(-840).max(840).catch(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate).optional().catch(undefined),
  calendarMonth: z.string().regex(/^\d{4}-\d{2}$/).refine(isCalendarMonth).optional().catch(undefined),
  timeZone: z.string().max(100).refine(isValidTimeZone).catch("UTC"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type TaskSearchParams = z.infer<typeof paramsSchema>;

export function parseTaskSearchParams(input: Record<string, string | string[] | undefined>): TaskSearchParams {
  const parsed = paramsSchema.safeParse({
    view: typeof input.view === "string" ? input.view : "my",
    q: typeof input.q === "string" ? input.q : "",
    priority: typeof input.priority === "string" ? input.priority : "all",
    type: typeof input.type === "string" ? input.type : "all",
    sort: typeof input.sort === "string" ? input.sort : "due_date",
    timezoneOffset: typeof input.timezoneOffset === "string" ? Number(input.timezoneOffset) : 0,
    tomorrowTimezoneOffset: typeof input.tomorrowTimezoneOffset === "string" ? Number(input.tomorrowTimezoneOffset) : 0,
    weekStartTimezoneOffset: typeof input.weekStartTimezoneOffset === "string" ? Number(input.weekStartTimezoneOffset) : 0,
    nextWeekTimezoneOffset: typeof input.nextWeekTimezoneOffset === "string" ? Number(input.nextWeekTimezoneOffset) : 0,
    date: typeof input.date === "string" ? input.date : undefined,
    calendarMonth: typeof input.calendarMonth === "string" ? input.calendarMonth : undefined,
    timeZone: typeof input.timeZone === "string" ? input.timeZone : "UTC",
    page: typeof input.page === "string" ? input.page : "1",
  });
  return parsed.success ? parsed.data : { view: "my", q: "", priority: "all", type: "all", sort: "due_date", timezoneOffset: 0, tomorrowTimezoneOffset: 0, weekStartTimezoneOffset: 0, nextWeekTimezoneOffset: 0, timeZone: "UTC", page: 1 };
}

export function restrictAllTasksView(params: TaskSearchParams): TaskSearchParams {
  return params.view === "all" ? { ...params, view: "my" } : params;
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(200),
  description: z.string().trim().max(5000).optional().transform((value) => value || null),
  type: z.enum(taskTypes),
  priority: z.enum(taskPriorities),
  dueAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().transform((value) => value || null),
  reminderAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().transform((value) => value || null),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null),
  relatedType: z.union([z.enum(taskRelations), z.literal("")]).optional().transform((value) => value || null),
  relatedId: z.union([z.string().uuid(), z.literal("")]).optional().transform((value) => value || null),
}).refine((value) => (value.relatedType === null) === (value.relatedId === null), {
  message: "Choose both a related record type and record.", path: ["relatedId"],
});

export const updateTaskSchema = createTaskSchema;

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

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isCalendarMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function taskLocalDateBounds(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = zonedLocalMidnightUtc(year, month, day, timeZone);
  const end = zonedLocalMidnightUtc(year, month, day + 1, timeZone);
  return { start: new Date(start), end: new Date(end) };
}

function zonedLocalMidnightUtc(year: number, month: number, day: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const local = Object.fromEntries(parts.filter(({ type }) => ["year", "month", "day", "hour", "minute", "second"].includes(type)).map(({ type, value }) => [type, Number(value)]));
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const correction = target - represented;
    candidate += correction;
    if (correction === 0) break;
  }
  return candidate;
}

export function taskDateBounds(now: Date, timezoneOffset: number, tomorrowTimezoneOffset = timezoneOffset) {
  const localNow = new Date(now.getTime() - timezoneOffset * 60_000);
  const [year, month, day] = localNow.toISOString().slice(0, 10).split("-").map(Number);
  const start = Date.UTC(year, month - 1, day) + timezoneOffset * 60_000;
  const tomorrow = Date.UTC(year, month - 1, day + 1) + tomorrowTimezoneOffset * 60_000;
  const dayAfterTomorrow = Date.UTC(year, month - 1, day + 2) + tomorrowTimezoneOffset * 60_000;
  return { start: new Date(start), tomorrow: new Date(tomorrow), dayAfterTomorrow: new Date(dayAfterTomorrow) };
}

export function taskWeekBounds(now: Date, timezoneOffset: number, weekStartTimezoneOffset: number, nextWeekTimezoneOffset: number) {
  const localNow = new Date(now.getTime() - timezoneOffset * 60_000);
  const [year, month, day] = localNow.toISOString().slice(0, 10).split("-").map(Number);
  const daysSinceMonday = (localNow.getUTCDay() + 6) % 7;
  const weekStart = Date.UTC(year, month - 1, day - daysSinceMonday);
  return {
    start: new Date(weekStart + weekStartTimezoneOffset * 60_000),
    end: new Date(weekStart + 7 * 24 * 60 * 60_000 + nextWeekTimezoneOffset * 60_000),
  };
}

