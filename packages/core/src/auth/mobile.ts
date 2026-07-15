/**
 * Mobile (Expo / React Native) session helper. Uses supabase-js with a caller-
 * provided storage adapter so the auth session persists across app launches.
 *
 * The app injects the concrete storage (AsyncStorage for general state, or a
 * SecureStore-backed adapter for sensitive tokens) — this keeps `@inkd/core`
 * free of any React-Native-only dependency while still owning the client config.
 *
 * This module is mobile-only — never import it from the web bundle.
 */
import { createClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv, type SupabaseEnv } from "../env";
import type { Database } from "../types/database";
import type { InkdSupabaseClient } from "../supabase/client";

/** Minimal async key/value store — satisfied by AsyncStorage and SecureStore
 * adapters alike (the shape supabase-js expects for `auth.storage`). */
export interface SupabaseStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface CreateNativeClientArgs extends Partial<SupabaseEnv> {
  /** Persistent storage for the auth session (e.g. AsyncStorage). Required for
   * the session to survive app restarts; omit only for ephemeral clients. */
  storage?: SupabaseStorageAdapter;
}

/**
 * Create the mobile Supabase client. Session auto-refresh is on; URL-based
 * session detection is off (RN has no browser URL). Reads EXPO_PUBLIC_* env by
 * default.
 *
 * @example
 *   import AsyncStorage from "@react-native-async-storage/async-storage";
 *   const supabase = createNativeSupabaseClient({ storage: AsyncStorage });
 */
export function createNativeSupabaseClient(
  args: CreateNativeClientArgs = {},
): InkdSupabaseClient {
  const { storage, ...override } = args;
  const { url, anonKey } = resolveSupabaseEnv(override);
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
