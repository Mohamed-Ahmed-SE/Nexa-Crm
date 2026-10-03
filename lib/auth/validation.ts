import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((fields) => fields.password === fields.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
  jobTitle: z.string().trim().max(100).optional().default(""),
});

export type FormState = { message: string; success?: boolean };
export const initialFormState: FormState = { message: "" };

export function safeInternalPath(candidate: string | null, fallback = "/app/dashboard"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  try {
    const resolved = new URL(candidate, "https://nexa.invalid");
    if (resolved.origin !== "https://nexa.invalid") return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
