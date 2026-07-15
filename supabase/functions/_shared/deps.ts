// Centralized third-party imports for the INKD edge functions. Keeping them in
// one place makes version bumps a single-file change and lets the test suite
// import the same Stripe/Supabase modules the functions use.
//
// Stripe: the official stripe-node package, pulled via Deno's npm: specifier.
// In Deno we MUST use the async crypto path (constructEventAsync, webhooks via
// SubtleCrypto) — the synchronous helpers throw at runtime.
export { default as Stripe } from "npm:stripe@17.5.0";

// Supabase JS — service-role admin client for webhook writes + auth verification.
export {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.48.1";
