// Service-role Supabase client for privileged server-side work (webhook ledger
// writes, reading a session across the client/artist boundary). The service
// role bypasses RLS, so this MUST never be exposed to a browser — it lives only
// inside edge functions. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Supabase functions runtime.
import { createClient, type SupabaseClient } from "./deps.ts";
import { requireEnv } from "./env.ts";

export function getAdminClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { SupabaseClient };
