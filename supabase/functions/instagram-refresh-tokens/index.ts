// POST /functions/v1/instagram-refresh-tokens   (verify_jwt = false)
//
// Scheduled maintenance: refresh long-lived Instagram tokens before they lapse.
// Refreshes every connection whose token_expires_at is within 14 days AND whose
// last refresh (last_refreshed_at, else connected_at) is >24h ago (Instagram
// requires tokens be >=24h old and unexpired to refresh). Per-connection errors
// are collected without aborting the batch.
//
// AUTH: copies the project's established scheduled-fn pattern
// (_shared/agent-auth.ts): a shared bearer token in AGENT_RUNNER_TOKEN, falling
// back to the service-role key. (No x-cron-secret header is used — that pattern
// does not exist in this project.)
//
// Docs: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
import {
  handlePreflight,
  igConfig,
  notConfigured,
  isAuthorizedRunner,
  getAdminClient,
  jsonResponse,
  errorResponse,
  errors,
  igGetJson,
  IG_GRAPH,
} from "../_shared/ig-common.ts";

const REFRESH_WINDOW_MS = 14 * 24 * 3600 * 1000; // refresh when expiring within 14d
const MIN_AGE_MS = 24 * 3600 * 1000; // Instagram requires token age >= 24h

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const cfg = igConfig();
    if (!cfg) return notConfigured();

    if (!isAuthorizedRunner(req)) throw errors.unauthorized("Runner token required");

    const admin = getAdminClient();
    const now = Date.now();
    const expiryCutoff = new Date(now + REFRESH_WINDOW_MS).toISOString();

    const { data: conns, error } = await admin
      .from("instagram_connections")
      .select("id, artist_id, token_expires_at, last_refreshed_at, connected_at")
      .lte("token_expires_at", expiryCutoff);
    if (error) throw errors.server(error.message);

    let refreshed = 0;
    let skipped = 0;
    const errorsOut: Array<{ id: string; reason: string }> = [];

    for (const c of conns ?? []) {
      const expMs = c.token_expires_at ? new Date(c.token_expires_at).getTime() : 0;
      const lastMs = new Date(c.last_refreshed_at ?? c.connected_at ?? 0).getTime();
      // Only refresh tokens that are unexpired and >=24h old.
      if (expMs <= now || now - lastMs < MIN_AGE_MS) {
        skipped += 1;
        continue;
      }

      // Read the token in isolation (never logged / returned).
      const { data: tokenRow, error: tErr } = await admin
        .from("instagram_connections")
        .select("access_token")
        .eq("id", c.id)
        .single();
      if (tErr || !tokenRow?.access_token) {
        errorsOut.push({ id: c.id, reason: "token_read_failed" });
        continue;
      }

      try {
        const url = new URL(`${IG_GRAPH}/refresh_access_token`);
        url.searchParams.set("grant_type", "ig_refresh_token");
        url.searchParams.set("access_token", tokenRow.access_token);
        const res = await igGetJson(url.toString());
        const newToken: string | undefined = res?.access_token;
        const expiresInSec: number = typeof res?.expires_in === "number" ? res.expires_in : 60 * 24 * 3600;
        if (!newToken) {
          errorsOut.push({ id: c.id, reason: "no_token_in_response" });
          continue;
        }
        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin
          .from("instagram_connections")
          .update({
            access_token: newToken,
            token_expires_at: new Date(now + expiresInSec * 1000).toISOString(),
            last_refreshed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", c.id);
        if (upErr) {
          errorsOut.push({ id: c.id, reason: "db_update_failed" });
          continue;
        }
        refreshed += 1;
      } catch (e) {
        errorsOut.push({ id: c.id, reason: e instanceof Error ? e.message.slice(0, 120) : "refresh_failed" });
      }
    }

    return jsonResponse({
      candidates: conns?.length ?? 0,
      refreshed,
      skipped,
      errors: errorsOut,
    });
  } catch (err) {
    if (!(err && (err as { name?: string }).name === "AppError")) console.error("instagram-refresh-tokens:", err);
    return errorResponse(err);
  }
});
