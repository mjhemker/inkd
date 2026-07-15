import { z } from "zod";

/**
 * Auth input schemas. Every auth entry point validates through these so both
 * platforms (web forms, mobile forms) share identical rules and error copy.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const magicLinkSchema = z.object({
  email: emailSchema,
  /** Where the magic-link / OTP callback should land (platform-specific). */
  emailRedirectTo: z.string().url().optional(),
  /** Create the user if they do not exist yet (default true for sign-up flows). */
  shouldCreateUser: z.boolean().optional(),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url().optional(),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
