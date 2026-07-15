// Instagram OAuth + Graph API helpers ("Instagram API with Instagram Login" —
// see docs/instagram-integration.md; Basic Display API is dead, this is the
// current replacement). Everything here is pure/isomorphic — no `Deno.*`
// references — so it runs unmodified under both the Deno edge function and
// Node's built-in test runner:
//   node --test supabase/functions/_shared/instagram.test.ts
//
// Only `fetch`, `crypto.subtle`, `URL`, `URLSearchParams`, `atob`/`btoa` are
// used, all present as globals in Deno and in Node >= 18.

// ---------------------------------------------------------------------------
// Endpoints + scopes
// ---------------------------------------------------------------------------

export const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const IG_GRAPH_BASE = "https://graph.instagram.com";

/** Read-only portfolio import needs exactly this scope — see
 * docs/instagram-integration.md §3/§4 for why we stop here. */
export const IG_SCOPES = ["instagram_business_basic"] as const;

// ---------------------------------------------------------------------------
// Signed `state` — proves the OAuth callback belongs to the artist who
// started the flow, without a Supabase session (Meta's redirect carries no
// JWT). HMAC-SHA256 over `artistId.nonce.expiresAt`, keyed on IG_APP_SECRET.
// ---------------------------------------------------------------------------

export interface StatePayload {
  artistId: string;
  nonce: string;
  /** Epoch millis. */
  expiresAt: number;
}

export interface VerifyStateResult {
  valid: boolean;
  artistId?: string;
  reason?: "malformed" | "signature" | "expired";
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToAscii(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return atob(b64);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sign a state payload into the opaque `state` query param. */
export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = `${payload.artistId}.${payload.nonce}.${payload.expiresAt}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const bodyBytes = new TextEncoder().encode(body);
  return `${bytesToBase64Url(bodyBytes.buffer as ArrayBuffer)}.${bytesToBase64Url(sig)}`;
}

/** Verify + decode a `state` query param. Never throws. */
export async function verifyState(state: string, secret: string): Promise<VerifyStateResult> {
  const parts = state.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [bodyB64, sigB64] = parts;

  let body: string;
  try {
    body = base64UrlToAscii(bodyB64);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const key = await hmacKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expectedSigB64 = bytesToBase64Url(expectedSig);
  if (!timingSafeEqual(expectedSigB64, sigB64)) return { valid: false, reason: "signature" };

  const bodyParts = body.split(".");
  if (bodyParts.length !== 3) return { valid: false, reason: "malformed" };
  const [artistId, , expiresAtStr] = bodyParts;
  const expiresAt = Number(expiresAtStr);
  if (!artistId || !Number.isFinite(expiresAt)) return { valid: false, reason: "malformed" };
  if (Date.now() > expiresAt) return { valid: false, artistId, reason: "expired" };

  return { valid: true, artistId };
}

/** A fresh random nonce for a new state payload. */
export function newNonce(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Authorize URL
// ---------------------------------------------------------------------------

export interface BuildAuthorizeUrlOpts {
  appId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
}

export function buildAuthorizeUrl(opts: BuildAuthorizeUrlOpts): string {
  const url = new URL(IG_AUTHORIZE_URL);
  url.searchParams.set("client_id", opts.appId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (opts.scopes ?? IG_SCOPES).join(","));
  url.searchParams.set("state", opts.state);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token exchange + refresh (I/O — not unit tested; shapes match Meta's docs)
// ---------------------------------------------------------------------------

export interface ShortLivedToken {
  access_token: string;
  user_id: string;
  permissions?: string[];
}

export async function exchangeCodeForToken(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<ShortLivedToken> {
  const body = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
  const res = await fetch(IG_TOKEN_URL, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`Instagram token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ShortLivedToken;
}

export interface LongLivedToken {
  access_token: string;
  token_type: string;
  /** Seconds until expiry (60 days for a fresh exchange/refresh). */
  expires_in: number;
}

export async function exchangeForLongLivedToken(opts: {
  appSecret: string;
  accessToken: string;
}): Promise<LongLivedToken> {
  const url = new URL(`${IG_GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", opts.appSecret);
  url.searchParams.set("access_token", opts.accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram long-lived token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as LongLivedToken;
}

/** Token must be >= 24h old and not yet expired. */
export async function refreshLongLivedToken(accessToken: string): Promise<LongLivedToken> {
  const url = new URL(`${IG_GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as LongLivedToken;
}

// ---------------------------------------------------------------------------
// Graph reads
// ---------------------------------------------------------------------------

export interface IgProfile {
  id: string;
  username: string;
}

export async function fetchInstagramProfile(accessToken: string): Promise<IgProfile> {
  const url = new URL(`${IG_GRAPH_BASE}/me`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram profile fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as IgProfile;
}

export interface IgMediaItem {
  id: string;
  caption?: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
}

export interface IgMediaPage {
  data: IgMediaItem[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export async function fetchInstagramMediaPage(opts: {
  accessToken: string;
  after?: string;
  limit?: number;
}): Promise<IgMediaPage> {
  const url = new URL(`${IG_GRAPH_BASE}/me/media`);
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
  );
  url.searchParams.set("access_token", opts.accessToken);
  url.searchParams.set("limit", String(opts.limit ?? 25));
  if (opts.after) url.searchParams.set("after", opts.after);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram media fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as IgMediaPage;
}
