// GET /functions/v1/instagram-oauth-callback
//
// Meta redirects the browser here (unauthenticated), so verify_jwt = false.
// Trust is re-established solely from the signed `state` minted by
// instagram-oauth-start. We exchange code -> short-lived -> long-lived token,
// fetch the IG username/user_id, upsert the connection for the artist, then
// 302 back into the app. Tokens are never logged or returned to the browser.
//
// return_to (§6.2): once `state` is verified, its whitelisted relative `return_to`
// (if any) is the redirect target instead of the hardcoded /studio/settings; the
// `?instagram=connected` / `?instagram=error&reason=...` params are preserved.
// Errors that occur BEFORE state is verified keep the /studio/settings default
// (there is no trusted return path yet).
import { createClient } from "npm:@supabase/supabase-js@2.48.1";

const AUTHORIZE_TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_ENDPOINT = "https://graph.instagram.com/access_token";
const ME_ENDPOINT = "https://graph.instagram.com/v23.0/me";
const SCOPE = "instagram_business_basic";
const DEFAULT_RETURN = "/studio/settings";

function appUrlBase(): string {
  const raw = Deno.env.get("PUBLIC_APP_URL");
  const base = raw && raw.trim() !== "" ? raw.trim() : "https://getinkd.co";
  return base.replace(/\/+$/, "");
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

// Build an absolute redirect into the app at a whitelisted relative path,
// setting the `?instagram=...` params (preserving any query already on the path).
function redirectTo(returnTo: string, params: Record<string, string>): Response {
  const dest = new URL(`${appUrlBase()}${returnTo}`);
  for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);
  return redirect(dest.toString());
}

function successRedirect(returnTo: string = DEFAULT_RETURN): Response {
  return redirectTo(returnTo, { instagram: "connected" });
}

function errorRedirect(reason: string, returnTo: string = DEFAULT_RETURN): Response {
  return redirectTo(returnTo, { instagram: "error", reason });
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v || v.trim() === "") throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function b64urlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// return_to whitelist: only relative in-app paths ("/...", never "//host").
// (Kept in sync with _shared/ig-common.ts sanitizeReturnTo — tested offline in
// _shared/ig-return-to.test.ts.)
function sanitizeReturnTo(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

async function verifyState(
  state: string,
  secret: string,
): Promise<{ artist_id: string; return_to: string | null } | null> {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = await hmacHex(payload, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  let obj: { artist_id?: unknown; exp?: unknown; return_to?: unknown };
  try {
    obj = JSON.parse(b64urlDecodeToString(payload));
  } catch {
    return null;
  }
  if (typeof obj.artist_id !== "string" || typeof obj.exp !== "number") return null;
  if (obj.exp < Math.floor(Date.now() / 1000)) return null;
  return { artist_id: obj.artist_id, return_to: sanitizeReturnTo(obj.return_to) };
}

Deno.serve(async (req) => {
  try {
    const appId = Deno.env.get("INSTAGRAM_APP_ID");
    const appSecret = Deno.env.get("INSTAGRAM_APP_SECRET");
    if (!appId || appId.trim() === "" || !appSecret || appSecret.trim() === "") {
      return errorRedirect("not_configured");
    }

    const url = new URL(req.url);
    const params = url.searchParams;

    // User denied on the Meta consent screen, or Meta returned an error.
    if (params.get("error")) return errorRedirect("access_denied");

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return errorRedirect("missing_params");

    const verified = await verifyState(state, appSecret);
    if (!verified) return errorRedirect("invalid_state");
    const artistId = verified.artist_id;
    // From here on we have a trusted return path (or the default).
    const returnTo = verified.return_to ?? DEFAULT_RETURN;

    const redirectUri = `${requireEnv("SUPABASE_URL")}/functions/v1/instagram-oauth-callback`;

    // 1) Exchange authorization code for a short-lived token (form-POST).
    const shortForm = new URLSearchParams();
    shortForm.set("client_id", appId);
    shortForm.set("client_secret", appSecret);
    shortForm.set("grant_type", "authorization_code");
    shortForm.set("redirect_uri", redirectUri);
    shortForm.set("code", code);
    const shortResp = await fetch(AUTHORIZE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: shortForm.toString(),
    });
    if (!shortResp.ok) return errorRedirect("token_exchange_failed", returnTo);
    const shortData = await shortResp.json();
    const shortToken = shortData?.access_token as string | undefined;
    if (!shortToken) return errorRedirect("token_exchange_failed", returnTo);
    // Granted permissions may arrive as array or CSV; normalise, fall back to scope.
    let scopes: string[] = [SCOPE];
    const perms = shortData?.permissions;
    if (Array.isArray(perms) && perms.length) scopes = perms.map((p: unknown) => String(p));
    else if (typeof perms === "string" && perms.trim() !== "") scopes = perms.split(",").map((s) => s.trim());

    // 2) Exchange the short-lived token for a long-lived token (GET).
    const longUrl = new URL(LONG_LIVED_ENDPOINT);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortToken);
    const longResp = await fetch(longUrl.toString());
    if (!longResp.ok) return errorRedirect("long_token_failed", returnTo);
    const longData = await longResp.json();
    const longToken = longData?.access_token as string | undefined;
    const expiresIn = Number(longData?.expires_in);
    if (!longToken || !Number.isFinite(expiresIn)) return errorRedirect("long_token_failed", returnTo);

    // 3) Fetch the account's user_id + username with the long-lived token.
    const meUrl = new URL(ME_ENDPOINT);
    meUrl.searchParams.set("fields", "user_id,username");
    meUrl.searchParams.set("access_token", longToken);
    const meResp = await fetch(meUrl.toString());
    if (!meResp.ok) return errorRedirect("profile_fetch_failed", returnTo);
    const meData = await meResp.json();
    const igUserId = meData?.user_id != null ? String(meData.user_id) : undefined;
    const igUsername = meData?.username != null ? String(meData.username) : null;
    if (!igUserId) return errorRedirect("profile_fetch_failed", returnTo);

    // 4) Upsert the connection keyed on artist_id (no unique index exists, so
    //    resolve manually with the service role).
    const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAtIso = new Date(now.getTime() + expiresIn * 1000).toISOString();

    const { data: existing, error: exErr } = await admin
      .from("instagram_connections")
      .select("id")
      .eq("artist_id", artistId)
      .maybeSingle();
    if (exErr) return errorRedirect("db_error", returnTo);

    if (existing?.id) {
      const { error: updErr } = await admin
        .from("instagram_connections")
        .update({
          ig_user_id: igUserId,
          ig_username: igUsername,
          access_token: longToken,
          token_expires_at: expiresAtIso,
          scopes,
          last_refreshed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (updErr) return errorRedirect("db_error", returnTo);
    } else {
      const { error: insErr } = await admin.from("instagram_connections").insert({
        artist_id: artistId,
        ig_user_id: igUserId,
        ig_username: igUsername,
        access_token: longToken,
        token_expires_at: expiresAtIso,
        scopes,
        connected_at: nowIso,
        updated_at: nowIso,
      });
      if (insErr) return errorRedirect("db_error", returnTo);
    }

    return successRedirect(returnTo);
  } catch (err) {
    // Never surface token material; log only a generic marker.
    console.error("instagram-oauth-callback: unexpected error");
    return errorRedirect("server_error");
  }
});
