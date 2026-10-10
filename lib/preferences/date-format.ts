export const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "MM/DD/YYYY";

export function isDateFormat(value: unknown): value is DateFormat {
  return typeof value === "string" && DATE_FORMATS.includes(value as DateFormat);
}

export function normalizeDateFormat(value: unknown): DateFormat {
  return isDateFormat(value) ? value : DEFAULT_DATE_FORMAT;
}

type CalendarDateOptions = { timeZone?: string };

export function formatCalendarDate(value: string | Date, dateFormat: DateFormat, options: CalendarDateOptions = {}): string {
  const dateOnlyParts = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const date = dateOnlyParts ? new Date(Date.UTC(Number(dateOnlyParts[1]), Number(dateOnlyParts[2]) - 1, Number(dateOnlyParts[3]))) : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: dateOnlyParts ? "UTC" : options.timeZone,
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  if (dateFormat === "YYYY-MM-DD") return `${fields.year}-${fields.month}-${fields.day}`;
  return dateFormat === "DD/MM/YYYY" ? `${fields.day}/${fields.month}/${fields.year}` : `${fields.month}/${fields.day}/${fields.year}`;
}

export function formatCalendarDateTime(value: string | Date, dateFormat: DateFormat, timeZone?: string): string {
  const date = new Date(value);
  const calendarDate = formatCalendarDate(date, dateFormat, { timeZone });
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(date);
  return `${calendarDate}, ${time}`;
}
