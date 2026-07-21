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

// --- Instagram --------------------------------------------------------------
// The Instagram edge functions own their own config gating: the Instagram app
// credentials (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET) are read via
// `igConfig()` in _shared/ig-common.ts, which returns a 503
// `instagram_not_configured` when either secret is absent. There is no
// Instagram helper in this module.
