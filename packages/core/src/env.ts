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
export const supabaseEnvSchema = z.object({
  url: z.string().url("Supabase URL must be a valid URL"),
  anonKey: z.string().min(1, "Supabase anon key is required"),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

type EnvBag = Record<string, string | undefined>;

function readEnv(): EnvBag {
  if (typeof process !== "undefined" && process.env) {
    return process.env as EnvBag;
  }
  return {};
}

/**
 * Resolve Supabase config from whichever platform's env vars are present.
 * Accepts an explicit override (useful for tests / server-only keys).
 */
export function resolveSupabaseEnv(override?: Partial<SupabaseEnv>): SupabaseEnv {
  const env = readEnv();

  const url =
    override?.url ??
    env.NEXT_PUBLIC_SUPABASE_URL ??
    env.EXPO_PUBLIC_SUPABASE_URL;

  const anonKey =
    override?.anonKey ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  return supabaseEnvSchema.parse({ url, anonKey });
}
