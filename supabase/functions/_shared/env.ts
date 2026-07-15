// Environment resolution for the INKD edge functions.
//
// NOTE (no keys yet): every secret is read from Deno.env at runtime. Nothing is
// hard-coded. When Michael adds the Stripe keys as Supabase function secrets,
// these resolve automatically — wiring the keys is the ONLY remaining step.
//
// Required secrets (set with `supabase secrets set`):
//   STRIPE_SECRET_KEY        sk_test_... (and later sk_live_...)
//   STRIPE_WEBHOOK_SECRET    whsec_...   (from the webhook endpoint)
// Auto-injected by the Supabase runtime (do NOT set manually):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional (have safe defaults):
//   INKD_FEE_BPS             INKD application fee in basis points (default 1000 = 10%)
//   INKD_APP_URL             base URL for Stripe return/refresh + checkout redirects
//   STRIPE_CURRENCY          ISO currency (default "usd")

/** Read a required env var or throw a descriptive configuration error. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Read an optional env var with a fallback. */
export function optionalEnv(name: string, fallback: string): string {
  const value = Deno.env.get(name);
  return value && value.trim() !== "" ? value : fallback;
}

/** Thrown when a required secret/config value is absent. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const DEFAULT_INKD_FEE_BPS = 1000; // 10%

/**
 * Resolve the INKD application fee in basis points. Configurable via INKD_FEE_BPS;
 * defaults to 1000 (10%). Clamped to a sane 0–5000 (0%–50%) range so a typo can
 * never charge a client more than half the deposit.
 */
export function resolveInkdFeeBps(): number {
  const raw = Deno.env.get("INKD_FEE_BPS");
  if (raw == null || raw.trim() === "") return DEFAULT_INKD_FEE_BPS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_INKD_FEE_BPS;
  return Math.min(parsed, 5000);
}

export function resolveCurrency(): string {
  return optionalEnv("STRIPE_CURRENCY", "usd").toLowerCase();
}

/** Base URL used to build Stripe return/refresh + checkout success/cancel URLs. */
export function resolveAppUrl(): string {
  return optionalEnv("INKD_APP_URL", "https://getinkd.co").replace(/\/+$/, "");
}

// --- Instagram (see docs/instagram-integration.md) --------------------------
// Required secrets (set with `supabase secrets set`), all absent until Michael
// creates the Meta app:
//   IG_APP_ID          Instagram App ID from the Meta app's Instagram product
//   IG_APP_SECRET       Instagram App Secret — also the HMAC key for the signed
//                        OAuth `state` param (see _shared/instagram.ts)
//   IG_REDIRECT_URL      must exactly match the redirect URI registered in the
//                        Meta app's Instagram Platform settings

/** True only when every Instagram secret is present. Gates every UI surface —
 * see docs/instagram-integration.md §5. Never throws. */
export function isInstagramConfigured(): boolean {
  return (
    Boolean(Deno.env.get("IG_APP_ID")?.trim()) &&
    Boolean(Deno.env.get("IG_APP_SECRET")?.trim()) &&
    Boolean(Deno.env.get("IG_REDIRECT_URL")?.trim())
  );
}
