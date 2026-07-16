// POST /functions/v1/delete-account
//
// Permanently deletes the authenticated user's INKD account. The caller proves
// identity with their own Supabase JWT (verify_jwt = true at the gateway; we
// re-verify in code). We then use the service-role admin API to delete the
// auth.users row — which cascades to public.profiles and, from there, to every
// owned row (artist_profiles → services, bookings, portfolio, waivers, threads,
// …). A handful of references are ON DELETE SET NULL (messages.sender,
// payments.client, signed_waivers.client, agent_actions.client/approved_by) so
// counterparties' ledgers/records survive with the deleted user nulled out.
//
// Storage objects are NOT covered by the DB cascade, so we best-effort remove
// the user's own objects (avatars/portfolio/posts/flash under `{uid}/…` in the
// `media` bucket, and their booking uploads under `{uid}/…` in `booking-uploads`).
//
// SELF-CONTAINED (no ../_shared imports) so the exact file that lives in the repo
// is what gets deployed via the Supabase MCP `deploy_edge_function`, with no
// relative-dependency bundling. Needs NO external keys — only the auto-injected
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.
//
// Request:  (no body required)
// Response: { ok: true, deleted_user_id }
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.48.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORAGE_BUCKETS = ["media", "booking-uploads"] as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v || v.trim() === "") throw new Error(`Missing environment variable: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: { code: "bad_request", message: "Use POST" } }, 400);
    }

    // --- Verify the caller's JWT and resolve their user id ------------------
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);
    }

    const url = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: { code: "unauthorized", message: "Invalid or expired session" } }, 401);
    }
    const userId = userData.user.id;

    // --- Service-role admin client -----------------------------------------
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- Best-effort storage cleanup (never blocks account deletion) -------
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const paths = await collectObjectPaths(admin, bucket, userId);
        for (let i = 0; i < paths.length; i += 100) {
          await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
        }
      } catch (e) {
        console.error(`delete-account: storage cleanup failed for ${bucket}:`, e);
      }
    }

    // --- Delete the auth user (cascades the DB rows) -----------------------
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json({ error: { code: "server_error", message: delErr.message } }, 500);
    }

    return json({ ok: true, deleted_user_id: userId });
  } catch (err) {
    console.error("delete-account:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: { code: "server_error", message } }, 500);
  }
});

/**
 * Recursively collect every object path under `prefix` in `bucket`. Supabase's
 * storage `list` returns folder entries with a null `id`; we recurse into those
 * and accumulate leaf file paths.
 */
async function collectObjectPaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const out: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    // A null id marks a nested folder rather than a file object.
    if ((entry as { id: string | null }).id === null) {
      out.push(...(await collectObjectPaths(admin, bucket, path)));
    } else {
      out.push(path);
    }
  }
  return out;
}
