// Offline unit tests for the OAuth return_to whitelist + redirect building
// (§6.2). Zero-dependency; runs under Node's built-in runner:
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     supabase/functions/_shared/ig-return-to.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeReturnTo, buildInstagramRedirect } from "./ig-return-to.ts";

test("sanitizeReturnTo: accepts a relative in-app path", () => {
  assert.equal(sanitizeReturnTo("/onboarding/identity"), "/onboarding/identity");
  assert.equal(sanitizeReturnTo("/studio/settings"), "/studio/settings");
});

test("sanitizeReturnTo: preserves an existing query on the path", () => {
  assert.equal(sanitizeReturnTo("/onboarding?step=2"), "/onboarding?step=2");
});

test("sanitizeReturnTo: rejects protocol-relative (//host) — open-redirect guard", () => {
  assert.equal(sanitizeReturnTo("//evil.com/phish"), null);
});

test("sanitizeReturnTo: rejects absolute URLs", () => {
  assert.equal(sanitizeReturnTo("https://evil.com"), null);
  assert.equal(sanitizeReturnTo("http://evil.com"), null);
});

test("sanitizeReturnTo: rejects non-leading-slash / relative segments", () => {
  assert.equal(sanitizeReturnTo("onboarding/identity"), null);
  assert.equal(sanitizeReturnTo("../escape"), null);
});

test("sanitizeReturnTo: rejects empty + non-string", () => {
  assert.equal(sanitizeReturnTo(""), null);
  assert.equal(sanitizeReturnTo(null), null);
  assert.equal(sanitizeReturnTo(undefined), null);
  assert.equal(sanitizeReturnTo(42 as unknown), null);
});

test("buildInstagramRedirect: default settings path + connected param", () => {
  assert.equal(
    buildInstagramRedirect("https://getinkd.co", "/studio/settings", { instagram: "connected" }),
    "https://getinkd.co/studio/settings?instagram=connected",
  );
});

test("buildInstagramRedirect: custom return_to + error params", () => {
  assert.equal(
    buildInstagramRedirect("https://getinkd.co", "/onboarding/identity", {
      instagram: "error",
      reason: "db_error",
    }),
    "https://getinkd.co/onboarding/identity?instagram=error&reason=db_error",
  );
});

test("buildInstagramRedirect: preserves an existing query on the return_to path", () => {
  const out = buildInstagramRedirect("https://getinkd.co", "/onboarding?step=2", {
    instagram: "connected",
  });
  const u = new URL(out);
  assert.equal(u.pathname, "/onboarding");
  assert.equal(u.searchParams.get("step"), "2");
  assert.equal(u.searchParams.get("instagram"), "connected");
});

test("buildInstagramRedirect: strips a trailing slash on the base", () => {
  assert.equal(
    buildInstagramRedirect("https://getinkd.co/", "/studio/settings", { instagram: "connected" }),
    "https://getinkd.co/studio/settings?instagram=connected",
  );
});
