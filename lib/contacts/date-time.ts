export function normalizeContactDateTime(dateTimeInput: string, timezoneOffsetInput: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(dateTimeInput)) return dateTimeInput;
  const localDateTime = new Date(`${dateTimeInput}Z`);
  const timezoneOffsetMinutes = Number(timezoneOffsetInput);
  if (!timezoneOffsetInput.trim() || Number.isNaN(localDateTime.getTime()) || !Number.isInteger(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 840) return dateTimeInput;
  const utcDateTime = new Date(localDateTime.getTime() + timezoneOffsetMinutes * 60_000);
  return Number.isNaN(utcDateTime.getTime()) ? dateTimeInput : utcDateTime.toISOString();
}
