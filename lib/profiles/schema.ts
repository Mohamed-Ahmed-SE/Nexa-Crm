import { z } from "zod";

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

const optionalText = (maxLength: number, label: string) => z.string().trim()
  .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
  .transform((value) => value || null);

const avatarUrlSchema = z.string().trim()
  .max(2048, "Avatar URLs must be 2,048 characters or fewer.")
  .transform((value) => value || null)
  .refine((value) => value === null || isSafeHttpsUrl(value), "Enter a valid HTTPS avatar URL.")
  .transform((value) => value === null ? null : new URL(value).toString());

export const profileSchema = z.object({
  fullName: z.string().trim()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  avatarUrl: avatarUrlSchema,
  phone: optionalText(50, "Phone number"),
  jobTitle: optionalText(100, "Job title"),
  timezone: z.string().trim()
    .min(1, "Enter a timezone.")
    .max(100, "Timezones must be 100 characters or fewer.")
    .refine(isValidTimeZone, "Enter a valid IANA timezone."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
