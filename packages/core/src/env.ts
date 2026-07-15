import { z } from "zod";

/**
 * Supabase connection config, resolved from platform-specific public env vars.
 *
 *  - Web (Next.js): NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *  - Mobile (Expo):  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Both are safe to expose to the client (the anon key is public by design; RLS
 * enforces access — SPEC §2).
 */

// Local ambient so this file typechecks in consumers that don't ship
// @types/node (e.g. the Expo app's tsconfig). The literal `process.env.*`
// member expressions below are also what Next's DefinePlugin and Expo's Babel
// transform statically inline at build time — keep them literal.
declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

export const supabaseEnvSchema = z.object({
  url: z.string().url("Supabase URL must be a valid URL"),
  anonKey: z.string().min(1, "Supabase anon key is required"),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

function hasEnv(): boolean {
  return typeof process !== "undefined" && !!process && !!process.env;
}

/**
 * Resolve Supabase config from whichever platform's env vars are present.
 * Accepts an explicit override (useful for tests / server-only keys).
 */
export function resolveSupabaseEnv(override?: Partial<SupabaseEnv>): SupabaseEnv {
  const present = hasEnv();

  const url =
    override?.url ??
    (present ? process!.env!.NEXT_PUBLIC_SUPABASE_URL : undefined) ??
    (present ? process!.env!.EXPO_PUBLIC_SUPABASE_URL : undefined);

  const anonKey =
    override?.anonKey ??
    (present ? process!.env!.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined) ??
    (present ? process!.env!.EXPO_PUBLIC_SUPABASE_ANON_KEY : undefined);

  return supabaseEnvSchema.parse({ url, anonKey });
}
