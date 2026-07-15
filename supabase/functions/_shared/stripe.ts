// Stripe client factory. Reads STRIPE_SECRET_KEY at call time so the module can
// be imported (e.g. by tests) without any key present — only functions that
// actually talk to Stripe require the secret.
import { Stripe } from "./deps.ts";
import { requireEnv } from "./env.ts";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  cached = new Stripe(secretKey, {
    apiVersion: "2025-01-27.acacia",
    // Deno ships fetch + Web Crypto; use the fetch HTTP client so stripe-node
    // works without Node's http module.
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "INKD", version: "0.1.0" },
  });
  return cached;
}

/** Exposed for tests that want to reset the memoized singleton. */
export function __resetStripeForTests(): void {
  cached = null;
}

export type { Stripe };
