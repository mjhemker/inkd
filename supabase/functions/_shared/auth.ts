// Auth: verify the Supabase JWT on an incoming request and resolve the caller's
// profile + (optional) artist_profile. Every authenticated function calls this
// first; the webhook does NOT (it authenticates via Stripe signature instead).
import { createClient } from "./deps.ts";
import { requireEnv } from "./env.ts";
import { errors } from "./errors.ts";

export interface AuthedUser {
  id: string; // == profiles.id == auth.users.id
  email: string | null;
}

/**
 * Verify the bearer token on the request and return the authenticated user.
 * Throws `errors.unauthorized` when the header is missing or the token invalid.
 *
 * Uses a per-request anon client bound to the caller's JWT so `getUser()` is
 * validated by GoTrue — we never trust claims client-side.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw errors.unauthorized("Missing Authorization header");

  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    throw errors.unauthorized("Invalid or expired session");
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Non-throwing variant of {@link requireUser}: verify the request's bearer as a
 * Supabase USER JWT and return the user id, or `null` when the header is
 * missing/invalid. Used by functions that accept EITHER the AI-runtime bearer
 * (privileged, all-users) OR an ordinary signed-in user acting on their own
 * behalf (e.g. daily-drop `self` mode, tag-image `inline` mode). Never throws —
 * the caller decides how to respond to a null.
 */
export async function tryResolveUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;

  try {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
