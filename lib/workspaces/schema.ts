import { z } from "zod";

const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

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

const workspaceNameSchema = z.string().trim()
  .refine((name) => Array.from(name).length >= 2, "Workspace names must be at least 2 characters.")
  .refine((name) => Array.from(name).length <= 80, "Workspace names must be 80 characters or fewer.");

const logoUrlSchema = z.string().trim().max(2048, "Logo URLs must be 2,048 characters or fewer.")
  .transform((url) => url || null)
  .refine((url) => url === null || isSafeHttpsUrl(url), "Enter a valid HTTPS logo URL.")
  .transform((url) => url === null ? null : new URL(url).toString());

export const workspaceSettingsSchema = z.object({
  name: workspaceNameSchema,
  logoUrl: logoUrlSchema,
  defaultCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code.")
    .refine((currency) => supportedCurrencies.has(currency), "Choose a supported currency code."),
  timezone: z.string().trim().min(1, "Enter a timezone.").max(100, "Timezones must be 100 characters or fewer.")
    .refine(isValidTimeZone, "Enter a valid IANA timezone."),
});

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;
