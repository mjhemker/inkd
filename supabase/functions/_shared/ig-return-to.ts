// Pure, dependency-free extraction of the OAuth `return_to` handling used by
// instagram-oauth-start (mint state) and instagram-oauth-callback (302 back).
// No `npm:` / `Deno.*` imports, so it runs under Deno AND Node's test runner:
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     supabase/functions/_shared/ig-return-to.test.ts
//
// instagram-oauth-start and instagram-oauth-callback each inline an identical
// `sanitizeReturnTo` (they are otherwise self-contained, dependency-free edge
// functions). This module is the canonical, unit-tested copy of that logic — keep
// the inline copies in sync with it.

/** return_to whitelist: only relative in-app paths ("/...", never "//host"). */
export function sanitizeReturnTo(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/**
 * Build the absolute app redirect from a whitelisted relative `returnTo` path,
 * setting the `?instagram=...` params while preserving any query already present
 * on the path. Mirrors the callback's `redirectTo`.
 */
export function buildInstagramRedirect(
  base: string,
  returnTo: string,
  params: Record<string, string>,
): string {
  const dest = new URL(`${base.replace(/\/+$/, "")}${returnTo}`);
  for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);
  return dest.toString();
}
