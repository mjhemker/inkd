/**
 * Web (Next.js) session helpers built on `@supabase/ssr`. Cookie-based auth so
 * server components, route handlers, and middleware all share one session.
 *
 * This module is web-only — never import it from the mobile bundle.
 */
import {
  createBrowserClient,
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";

import { resolveSupabaseEnv, type SupabaseEnv } from "../env";
import type { Database } from "../types/database";
import type { InkdSupabaseClient } from "../supabase/client";

/** Route prefixes that require an authenticated session (SPEC §3/§4 surfaces).
 * Public-by-design surfaces stay OUT of this list: `/` (marketing), `/auth`,
 * `/try-on` (deep-linkable fit check), `/a/[handle]` (public artist profile),
 * and the discovery surfaces `/feed` + `/discover`. Everything that reads or
 * writes the signed-in user's own data is gated here. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/bookings",
  "/messages",
  "/settings",
  "/onboarding",
  "/studio",
  "/notifications",
  "/profile",
] as const;

/** True when `pathname` falls under a protected prefix. */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Artist-only surfaces — the "Studio" group. A signed-in client hitting any of
 * these is redirected to the shared feed (see middleware). */
export const ARTIST_ROUTE_PREFIXES = [
  "/dashboard",
  "/studio",
  "/settings",
] as const;

/** True when `pathname` is an artist-only surface. */
export function isArtistRoute(pathname: string): boolean {
  return ARTIST_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Artist surfaces that additionally require onboarding to be finished — an
 * artist with incomplete onboarding hitting these is nudged to /onboarding.
 * `/settings` is intentionally excluded so an artist can still reach their
 * account controls (it shows its own "finish setup" state). */
export const ONBOARDING_REQUIRED_PREFIXES = ["/dashboard", "/studio"] as const;

/** True when `pathname` requires completed artist onboarding. */
export function requiresCompletedOnboarding(pathname: string): boolean {
  return ONBOARDING_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Browser client for Client Components. Persists the session in cookies so it
 * stays in sync with the server. Reads NEXT_PUBLIC_* env by default.
 */
export function createBrowserSupabaseClient(
  override?: Partial<SupabaseEnv>,
): InkdSupabaseClient {
  const { url, anonKey } = resolveSupabaseEnv(override);
  // @supabase/ssr's published types were built against a different SupabaseClient
  // generic arity than the installed @supabase/supabase-js, so the structural
  // types don't line up even though the runtime client is a real SupabaseClient.
  // Normalize to the shared InkdSupabaseClient type at this boundary.
  return createBrowserClient<Database>(url, anonKey) as unknown as InkdSupabaseClient;
}

/** Cookie adapter the caller supplies (Next `cookies()` in RSC/route handlers,
 * or request/response cookies in middleware). Matches @supabase/ssr's shape. */
export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(
    cookies: { name: string; value: string; options?: CookieOptions }[],
  ): void;
}

/**
 * Server-side client (Server Components, Route Handlers, Server Actions,
 * middleware). The caller wires the cookie store because only they hold the
 * request context — keeps this package free of a hard `next` dependency.
 */
export function createServerSupabaseClient(
  cookies: CookieAdapter,
  override?: Partial<SupabaseEnv>,
): InkdSupabaseClient {
  const { url, anonKey } = resolveSupabaseEnv(override);
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (
        toSet: { name: string; value: string; options: CookieOptions }[],
      ) => cookies.setAll(toSet),
    },
  }) as unknown as InkdSupabaseClient;
}

export type { CookieOptions };
