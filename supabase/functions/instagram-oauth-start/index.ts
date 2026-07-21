// GET/POST /functions/v1/instagram-oauth-start
//
// Begins the "Instagram API with Instagram Login" business-login OAuth flow.
// verify_jwt = true: the Supabase gateway rejects unauthenticated callers (401)
// before this code runs. We additionally resolve the caller's artist_profiles.id
// (artist_profiles.profile_id == auth user id) and mint a signed `state` so the
// stateless callback can trust which artist to bind the connection to.
//
// CONTRACT:  -> { url }   (the Instagram authorize URL to redirect the browser to)
// If Instagram secrets are absent -> 503 { "error": "instagram_not_configured" }.
//
// return_to (§6.2): the client MAY pass a relative in-app path (query `?return_to=`
// or JSON body `{ "return_to": "/onboarding/identity" }`). It is whitelisted to
// relative paths via sanitizeReturnTo, carried inside the signed `state`, and the
// callback 302s back to it (preserving the `?instagram=...` params). Absent /
// invalid -> null -> the callback falls back to /studio/settings.
import { createClient } from "npm:@supabase/supabase-js@2.48.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const AUTHORIZE_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const SCOPE = "instagram_business_basic";
const STATE_TTL_SECONDS = 15 * 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v || v.trim() === "") throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

// return_to whitelist: only relative in-app paths ("/...", never "//host").
// (Kept in sync with _shared/ig-common.ts sanitizeReturnTo — tested offline in
// _shared/ig-return-to.test.ts.)
function sanitizeReturnTo(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/** Read a caller-supplied return_to from the query string or JSON body. */
async function readReturnTo(req: Request, url: URL): Promise<string | null> {
  const fromQuery = sanitizeReturnTo(url.searchParams.get("return_to"));
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text) as { return_to?: unknown };
        return sanitizeReturnTo(body?.return_to);
      }
    } catch {
      // ignore malformed bodies — return_to is optional
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Instagram configuration must be present, else the feature is unavailable.
    const appId = Deno.env.get("INSTAGRAM_APP_ID");
    const appSecret = Deno.env.get("INSTAGRAM_APP_SECRET");
    if (!appId || appId.trim() === "" || !appSecret || appSecret.trim() === "") {
      return json({ error: "instagram_not_configured" }, 503);
    }

    // Resolve the authenticated caller (gateway already verified the JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: { code: "unauthorized", message: "Invalid or expired session" } }, 401);
    }

    // Optional in-app return path (query or JSON body), whitelisted to relatives.
    const reqUrl = new URL(req.url);
    const returnTo = await readReturnTo(req, reqUrl);

    // Map the auth user to their artist profile (owner of the connection).
    const admin = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: artist, error: aErr } = await admin
      .from("artist_profiles")
      .select("id")
      .eq("profile_id", userData.user.id)
      .maybeSingle();
    if (aErr) return json({ error: { code: "server_error", message: aErr.message } }, 500);
    if (!artist) {
      return json({ error: { code: "forbidden", message: "Only an artist can connect Instagram" } }, 403);
    }

    // Signed, expiring state: base64url(JSON).hmacHex — the callback re-verifies.
    const nonceBytes = new Uint8Array(16);
    crypto.getRandomValues(nonceBytes);
    const payloadObj = {
      artist_id: artist.id as string,
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      nonce: b64urlEncode(nonceBytes),
      return_to: returnTo,
    };
    const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(payloadObj)));
    const sig = await hmacHex(payload, appSecret);
    const state = `${payload}.${sig}`;

    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;
    const authorizeUrl = new URL(AUTHORIZE_ENDPOINT);
    authorizeUrl.searchParams.set("client_id", appId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", SCOPE);
    authorizeUrl.searchParams.set("state", state);

    return json({ url: authorizeUrl.toString() });
  } catch (err) {
    console.error("instagram-oauth-start:", err instanceof Error ? err.message : "error");
    return json({ error: { code: "server_error", message: "Unexpected error" } }, 500);
  }
});
