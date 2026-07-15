import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";

import { resolveSupabaseEnv, type SupabaseEnv } from "../env";
import type { Database } from "../types/database";

export type InkdSupabaseClient = SupabaseClient<Database>;

export interface CreateSupabaseClientArgs extends Partial<SupabaseEnv> {
  /** Passed straight through to @supabase/supabase-js. */
  options?: SupabaseClientOptions<"public">;
}

/**
 * Create a typed Supabase client for INKD.
 *
 * Reads NEXT_PUBLIC_* (web) or EXPO_PUBLIC_* (mobile) env vars by default, or
 * accepts an explicit `url` / `anonKey` override. The returned client is typed
 * against the generated `Database` type (see `../types/database.ts`).
 *
 * This is the generic (no session-persistence) factory. For real apps prefer
 * the platform helpers: `@inkd/core/auth/web` (cookie/ssr) or
 * `@inkd/core/auth/mobile` (native storage).
 *
 * @example
 *   const supabase = createSupabaseClient();               // from env
 *   const supabase = createSupabaseClient({ url, anonKey }); // explicit
 */
export function createSupabaseClient(
  args: CreateSupabaseClientArgs = {},
): InkdSupabaseClient {
  const { options, ...override } = args;
  const { url, anonKey } = resolveSupabaseEnv(override);
  return createClient<Database>(url, anonKey, options);
}
