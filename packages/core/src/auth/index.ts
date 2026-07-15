/**
 * Platform-neutral auth surface. Safe to import from web OR mobile bundles —
 * contains NO @supabase/ssr (web-only) or native-storage (mobile-only) code.
 *
 * For platform session wiring import the subpath entrypoints instead:
 *   - web:    `@inkd/core/auth/web`    (@supabase/ssr cookie clients + middleware)
 *   - mobile: `@inkd/core/auth/mobile` (supabase-js + injected native storage)
 */
export * from "./schemas";
export * from "./core";
export * from "./role";
