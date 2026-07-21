// Shared helpers for the INKD Instagram import edge functions.
//
// "Instagram API with Instagram Login" (Business Login). Endpoints verified
// against the official docs (July 2026):
//   Business Login / OAuth overview:
//     https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
//   - Authorize:              https://www.instagram.com/oauth/authorize
//   - code -> short token:    POST https://api.instagram.com/oauth/access_token
//                             (client_id, client_secret, grant_type=authorization_code, redirect_uri, code)
//   - short -> long token:    GET  https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=...&access_token=...
//   - refresh long token:     GET  https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
//   - profile:                GET  https://graph.instagram.com/me?fields=user_id,username&access_token=...
//   - media:                  GET  https://graph.instagram.com/me/media?fields=...&access_token=...
//
// Scope requested for import is ONLY `instagram_business_basic` (no comments /
// messages scopes). Access tokens are NEVER logged and NEVER returned to clients.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.48.1";

export type { SupabaseClient };

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------
export const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const IG_GRAPH = "https://graph.instagram.com";
export const IG_SCOPE = "instagram_business_basic";
export const IG_MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp," +
  "children{id,media_type,media_url,thumbnail_url}";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v || v.trim() === "") throw errors.server(`Missing required env var: ${name}`);
  return v;
}
export function optionalEnv(name: string, fallback: string): string {
  const v = Deno.env.get(name);
  return v && v.trim() !== "" ? v : fallback;
}

/** Returns the Instagram app credentials, or null when either secret is unset. */
export function igConfig(): { appId: string; appSecret: string } | null {
  const appId = Deno.env.get("INSTAGRAM_APP_ID");
  const appSecret = Deno.env.get("INSTAGRAM_APP_SECRET");
  if (!appId || appId.trim() === "" || !appSecret || appSecret.trim() === "") return null;
  return { appId: appId.trim(), appSecret: appSecret.trim() };
}

/** Canonical redirect URI registered in Meta (derived from the project URL). */
export function redirectUri(): string {
  const base = optionalEnv("SUPABASE_URL", "https://khlpidflnvkqafkvkpfy.supabase.co");
  return `${base.replace(/\/$/, "")}/functions/v1/instagram-oauth-callback`;
}

// ---------------------------------------------------------------------------
// CORS + error envelope (mirrors the project's _shared/cors.ts + errors.ts)
// ---------------------------------------------------------------------------
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  unauthorized: (m = "Authentication required") => new AppError(401, "unauthorized", m),
  forbidden: (m = "Not permitted") => new AppError(403, "forbidden", m),
  notFound: (m = "Not found") => new AppError(404, "not_found", m),
  badRequest: (m = "Invalid request") => new AppError(400, "bad_request", m),
  conflict: (m = "Conflict") => new AppError(409, "conflict", m),
  server: (m = "Internal error") => new AppError(500, "server_error", m),
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extra },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return jsonResponse({ error: err.code, message: err.message }, err.status);
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return jsonResponse({ error: "server_error", message }, 500);
}

/** The standard 503 body returned when the Instagram secrets are not set. */
export function notConfigured(): Response {
  return jsonResponse({ error: "instagram_not_configured" }, 503);
}

// ---------------------------------------------------------------------------
// Supabase clients
// ---------------------------------------------------------------------------
export function getAdminClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Verify the caller's Supabase JWT (matches _shared/auth.ts). */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw errors.unauthorized("Missing Authorization header");
  const url = requireEnv("SUPABASE_URL");
  const anon = requireEnv("SUPABASE_ANON_KEY");
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw errors.unauthorized("Invalid or expired session");
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Resolve the caller's artist_profiles.id from their auth user id. */
export async function resolveArtistId(admin: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await admin
    .from("artist_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  if (!data) throw errors.forbidden("No artist profile for this user");
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Cron auth (copied from _shared/agent-auth.ts — the established scheduled-fn
// pattern: a shared bearer token in AGENT_RUNNER_TOKEN, falling back to the
// service-role key. NOT an x-cron-secret header.)
// ---------------------------------------------------------------------------
export function isAuthorizedRunner(req: Request): boolean {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  const runner = Deno.env.get("AGENT_RUNNER_TOKEN");
  if (runner && runner.trim() !== "" && bearer === runner) return true;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (svc && svc.trim() !== "" && bearer === svc) return true;
  return false;
}

// ---------------------------------------------------------------------------
// base64url + HMAC-SHA256 (state signing + Meta signed_request verification)
// ---------------------------------------------------------------------------
const te = new TextEncoder();
const td = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

export interface OAuthState {
  artist_id: string;
  exp: number;
  return_to: string | null;
}

/** Sign an OAuth `state` payload (base64url(json).base64url(sig)). */
export async function signState(payload: OAuthState, secret: string): Promise<string> {
  const p = b64urlEncode(te.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(p)));
  return `${p}.${b64urlEncode(sig)}`;
}

/** Verify + decode a signed `state`. Returns null on any tamper / parse error. */
export async function verifyState(state: string, secret: string): Promise<OAuthState | null> {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const p = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const key = await hmacKey(secret, ["verify"]);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), te.encode(p));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    return JSON.parse(td.decode(b64urlDecode(p))) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Parse + verify a Meta `signed_request` (format: base64url(sig).base64url(payload)).
 * The signature is HMAC-SHA256 of the payload segment keyed by the app secret.
 * Returns the decoded payload (contains `user_id`) or null when invalid.
 */
export async function parseSignedRequest(signed: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = signed.split(".");
  if (parts.length !== 2) return null;
  const [encSig, encPayload] = parts;
  const key = await hmacKey(secret, ["verify"]);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(encSig), te.encode(encPayload));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    return JSON.parse(td.decode(b64urlDecode(encPayload))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// return_to whitelist: only relative in-app paths ("/...", never "//host").
// ---------------------------------------------------------------------------
export function sanitizeReturnTo(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Fetch helpers (all Meta calls get a hard timeout).
// ---------------------------------------------------------------------------
export async function igFetch(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** GET a Meta JSON endpoint; throws an AppError (no token in the message). */
export async function igGetJson(url: string, timeoutMs = 15000): Promise<any> {
  let res: Response;
  try {
    res = await igFetch(url, {}, timeoutMs);
  } catch (_e) {
    throw errors.server("Instagram request timed out");
  }
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.error_message ?? `Instagram API error (${res.status})`;
    throw errors.server(msg);
  }
  return body;
}

// ---------------------------------------------------------------------------
// Storage: download an image to the public bucket, matching the app's existing
// convention `<artist_id>/portfolio/<timestamp>-<rand>.jpg` in `media-public`.
// CDN URLs from Instagram are ephemeral, so images are always copied at import.
// ---------------------------------------------------------------------------
function randToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function downloadToPublicBucket(
  admin: SupabaseClient,
  artistId: string,
  srcUrl: string,
): Promise<string> {
  let res: Response;
  try {
    res = await igFetch(srcUrl, {}, 25000);
  } catch (_e) {
    throw errors.server("Image download timed out");
  }
  if (!res.ok) throw errors.server(`Image download failed (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw errors.server("Downloaded image was empty");
  const path = `${artistId}/portfolio/${Date.now()}-${randToken()}.jpg`;
  const { error } = await admin.storage.from("media-public").upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw errors.server(`Storage upload failed: ${error.message}`);
  const { data } = admin.storage.from("media-public").getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Instagram media typing + importability helpers.
// ---------------------------------------------------------------------------
export interface IgChild {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}
export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data?: IgChild[] };
}

/** The best display image URL for a media item ("" when none is available). */
export function previewUrl(m: IgMedia): string {
  if (m.media_url) return m.media_url;
  if (m.thumbnail_url) return m.thumbnail_url;
  const kids = m.children?.data ?? [];
  for (const c of kids) {
    if (c.media_url) return c.media_url;
    if (c.thumbnail_url) return c.thumbnail_url;
  }
  return "";
}

/** Ordered list of importable image source URLs for a media item. */
export function imageUrlsFor(m: IgMedia): string[] {
  const type = (m.media_type ?? "").toUpperCase();
  if (type === "CAROUSEL_ALBUM") {
    const urls: string[] = [];
    for (const c of m.children?.data ?? []) {
      const u = c.media_url ?? c.thumbnail_url;
      if (u) urls.push(u);
    }
    return urls;
  }
  // IMAGE uses media_url; VIDEO uses thumbnail_url as the INKD still image.
  const u = type === "VIDEO" ? (m.thumbnail_url ?? m.media_url) : (m.media_url ?? m.thumbnail_url);
  return u ? [u] : [];
}

/** True when a media item has at least one downloadable image. */
export function isImportable(m: IgMedia): boolean {
  return imageUrlsFor(m).length > 0;
}
