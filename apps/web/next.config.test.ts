// Unit test for the /marketing -> inkd-landing.vercel.app proxy rewrite.
// Runs under Node's built-in runner with type-stripping:
//   node --test apps/web/next.config.test.ts
// Pins the exact rewrite shape so a future edit can't silently drop the
// bare-/marketing entry, the :path* passthrough, or change the landing
// origin without a test failing.
import { test } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "./next.config.ts";

const LANDING_ORIGIN = "https://inkd-landing.vercel.app";

/** Our config's rewrites() always returns a flat array (no beforeFiles/
 * afterFiles/fallback object form) — normalize the wider return type down to
 * that so callers don't have to juggle the union everywhere. */
async function getRewriteEntries() {
  const rewrites = await nextConfig.rewrites!();
  if (!Array.isArray(rewrites)) {
    throw new Error("expected rewrites() to return a flat array, not the beforeFiles/afterFiles/fallback object form");
  }
  return rewrites;
}

test("rewrites: proxies /marketing (bare) to the landing site root", async () => {
  const entries = await getRewriteEntries();
  const bare = entries.find((r) => r.source === "/marketing");
  assert.ok(bare, "expected a /marketing rewrite entry");
  assert.equal(bare.destination, `${LANDING_ORIGIN}/`);
});

test("rewrites: proxies /marketing/:path* to the same path on the landing site", async () => {
  const entries = await getRewriteEntries();
  const wildcard = entries.find((r) => r.source === "/marketing/:path*");
  assert.ok(wildcard, "expected a /marketing/:path* rewrite entry");
  assert.equal(wildcard.destination, `${LANDING_ORIGIN}/:path*`);
});

test("rewrites: does not touch /preview (the app's own internal marketing page)", async () => {
  const entries = await getRewriteEntries();
  const touchesPreview = entries.some(
    (r) => r.source === "/preview" || r.source.startsWith("/preview/"),
  );
  assert.equal(touchesPreview, false);
});
