// /functions/v1/instagram-oauth
//
// Instagram OAuth for the "Instagram API with Instagram Login" product (Basic
// Display API is dead — see docs/instagram-integration.md). This function is
// KEY-GATED: it only does real work once IG_APP_ID / IG_APP_SECRET /
// IG_REDIRECT_URL are set as Supabase function secrets; until then every
// action returns `configured: false` and the UI shows an honest "coming soon"
// state (see _shared/env.ts isInstagramConfigured()).
//
// verify_jwt = false at the gateway (see supabase/config.toml) because Meta's
// callback redirect carries no Supabase session — the function authenticates
// each action itself: `status` / `authorize-url` / `disconnect` / `refresh`
// require a bearer JWT (checked in code via requireUser); `callback` (Meta's
// GET redirect) authenticates via the signed `state` param instead.
//
// Actions (POST body `{ action }` unless noted):
//   status         -> { configured, connected, ig_username?, connected_at?, token_expires_at?, last_synced_at? }
//   authorize-url  -> { url }                          (redirect the browser here)
//   disconnect     -> { ok: true }
//   refresh        -> sanitized status (see `status`)   (manual refresh; cron wiring is a follow-up, see docs)
//   GET ?code=&state=  -> Meta's OAuth callback; 302s back to the app, never JSON
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { isInstagramConfigured, requireEnv, resolveAppUrl } from "../_shared/env.ts";
import { AppError, errors, errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  newNonce,
  refreshLongLivedToken,
  signState,
  verifyState,
} from "../_shared/instagram.ts";

const SETTINGS_TAB = "grow";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);

  // Meta's redirect back from the consent screen — GET, no JWT, carries
  // `code`+`state` on success or `error`(+`error_description`) on denial.
  if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) {
    return handleCallback(url);
  }

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST (or the Meta callback GET)");
    const body = await safeJson(req);
    const action = typeof body?.action === "string" ? body.action : "status";

    switch (action) {
      case "status":
        return await handleStatus(req);
      case "authorize-url":
        return await handleAuthorizeUrl(req);
      case "disconnect":
        return await handleDisconnect(req);
      case "refresh":
        return await handleRefresh(req);
      default:
        throw errors.badRequest(`Unknown action: ${action}`);
    }
  } catch (err) {
    if (!(err instanceof AppError)) console.error("instagram-oauth:", err);
    return errorResponse(err);
  }
});

// ---------------------------------------------------------------------------
// Shared: resolve the calling artist from the session JWT.
// ---------------------------------------------------------------------------
async function resolveArtist(req: Request) {
  const user = await requireUser(req);
  const admin = getAdminClient();
  const { data: artist, error } = await admin
    .from("artist_profiles")
    .select("id, profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  if (!artist) throw errors.forbidden("Only artists can connect Instagram");
  return artist;
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
async function handleStatus(req: Request): Promise<Response> {
  const configured = isInstagramConfigured();
  const artist = await resolveArtist(req);
  const admin = getAdminClient();

  const { data: connection, error } = await admin
    .from("instagram_connections")
    .select("ig_username, connected_at, token_expires_at, last_refreshed_at, last_synced_at")
    .eq("artist_id", artist.id)
    .maybeSingle();
  if (error) throw errors.server(error.message);

  return jsonResponse({
    configured,
    connected: Boolean(connection),
    ig_username: connection?.ig_username ?? null,
    connected_at: connection?.connected_at ?? null,
    token_expires_at: connection?.token_expires_at ?? null,
    last_synced_at: connection?.last_synced_at ?? null,
  });
}

// ---------------------------------------------------------------------------
// authorize-url
// ---------------------------------------------------------------------------
async function handleAuthorizeUrl(req: Request): Promise<Response> {
  if (!isInstagramConfigured()) {
    throw errors.badRequest(
      "Instagram isn't configured yet — set IG_APP_ID/IG_APP_SECRET/IG_REDIRECT_URL",
    );
  }
  const artist = await resolveArtist(req);

  const appId = requireEnv("IG_APP_ID");
  const appSecret = requireEnv("IG_APP_SECRET");
  const redirectUri = requireEnv("IG_REDIRECT_URL");

  const state = await signState(
    { artistId: artist.id, nonce: newNonce(), expiresAt: Date.now() + 10 * 60 * 1000 },
    appSecret,
  );

  const authorizeUrl = buildAuthorizeUrl({ appId, redirectUri, state });
  return jsonResponse({ url: authorizeUrl });
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------
async function handleDisconnect(req: Request): Promise<Response> {
  const artist = await resolveArtist(req);
  const admin = getAdminClient();
  const { error } = await admin
    .from("instagram_connections")
    .delete()
    .eq("artist_id", artist.id);
  if (error) throw errors.server(error.message);
  return jsonResponse({ ok: true });
}

// ---------------------------------------------------------------------------
// refresh — manual trigger; a scheduled equivalent of agent_run_tick's pg_cron
// wiring is the natural next step once this is live (see docs).
// ---------------------------------------------------------------------------
async function handleRefresh(req: Request): Promise<Response> {
  if (!isInstagramConfigured()) {
    throw errors.badRequest("Instagram isn't configured yet");
  }
  const artist = await resolveArtist(req);
  const admin = getAdminClient();

  const { data: connection, error } = await admin
    .from("instagram_connections")
    .select("access_token")
    .eq("artist_id", artist.id)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  if (!connection) throw errors.notFound("No Instagram connection to refresh");

  const refreshed = await refreshLongLivedToken(connection.access_token);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const { error: updErr } = await admin
    .from("instagram_connections")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("artist_id", artist.id);
  if (updErr) throw errors.server(updErr.message);

  return jsonResponse({ ok: true, token_expires_at: tokenExpiresAt });
}

// ---------------------------------------------------------------------------
// Meta's callback — always redirects the browser (never returns JSON), so a
// failure here is only visible via the redirected query param + server logs.
// ---------------------------------------------------------------------------
async function handleCallback(url: URL): Promise<Response> {
  const appUrl = resolveAppUrl();
  const settingsUrl = (params: Record<string, string>) => {
    const dest = new URL(`${appUrl}/settings`);
    dest.searchParams.set("tab", SETTINGS_TAB);
    for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);
    return dest.toString();
  };
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });

  if (url.searchParams.has("error")) {
    return redirect(settingsUrl({ instagram: "denied" }));
  }

  if (!isInstagramConfigured()) {
    return redirect(settingsUrl({ instagram: "error", reason: "not_configured" }));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirect(settingsUrl({ instagram: "error", reason: "missing_params" }));
  }

  try {
    const appId = requireEnv("IG_APP_ID");
    const appSecret = requireEnv("IG_APP_SECRET");
    const redirectUri = requireEnv("IG_REDIRECT_URL");

    const verified = await verifyState(state, appSecret);
    if (!verified.valid || !verified.artistId) {
      return redirect(settingsUrl({ instagram: "error", reason: verified.reason ?? "state" }));
    }

    const shortLived = await exchangeCodeForToken({ appId, appSecret, redirectUri, code });
    const longLived = await exchangeForLongLivedToken({
      appSecret,
      accessToken: shortLived.access_token,
    });
    const profile = await fetchInstagramProfile(longLived.access_token);

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from("instagram_connections")
      .upsert(
        {
          artist_id: verified.artistId,
          ig_user_id: profile.id,
          ig_username: profile.username,
          access_token: longLived.access_token,
          token_expires_at: tokenExpiresAt,
          scopes: ["instagram_business_basic"],
          connected_at: now,
          last_refreshed_at: now,
        },
        { onConflict: "artist_id" },
      );
    if (upsertErr) throw upsertErr;

    return redirect(settingsUrl({ instagram: "connected" }));
  } catch (err) {
    console.error("instagram-oauth callback:", err);
    return redirect(settingsUrl({ instagram: "error", reason: "exchange_failed" }));
  }
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
