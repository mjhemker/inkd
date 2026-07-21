// Regression tests for the auth-guard redirect builder — specifically the
// query-preservation fix (the "Known trap": the middleware used to drop the
// query string when bouncing to /auth, losing ?instagram=connected).
//   node --test packages/core/src/auth/routes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { nextParamFor, buildAuthRedirectPath } from "./routes.ts";

test("nextParamFor preserves path + query", () => {
  assert.equal(nextParamFor("/studio/settings"), "/studio/settings");
  assert.equal(
    nextParamFor("/studio/settings", "?instagram=connected"),
    "/studio/settings?instagram=connected",
  );
  assert.equal(
    nextParamFor("/studio/settings", "?instagram=error&reason=access_denied"),
    "/studio/settings?instagram=error&reason=access_denied",
  );
});

test("buildAuthRedirectPath encodes next and round-trips", () => {
  const path = buildAuthRedirectPath("/studio/settings", "?instagram=connected");
  // The query must be encoded (no raw ?/& leaking into the next value).
  assert.ok(path.startsWith("/auth?next="));
  assert.ok(path.includes("%3Finstagram%3Dconnected"));

  // Round-trip: decoding `next` yields back the exact destination.
  const search = path.slice(path.indexOf("?") + 1);
  const next = new URLSearchParams(search).get("next");
  assert.equal(next, "/studio/settings?instagram=connected");
});

test("buildAuthRedirectPath round-trips a multi-param callback return", () => {
  const path = buildAuthRedirectPath("/studio/settings", "?instagram=error&reason=access_denied");
  const search = path.slice(path.indexOf("?") + 1);
  const next = new URLSearchParams(search).get("next");
  assert.equal(next, "/studio/settings?instagram=error&reason=access_denied");
});

test("buildAuthRedirectPath handles a bare path (no query)", () => {
  const path = buildAuthRedirectPath("/dashboard");
  const next = new URLSearchParams(path.slice(path.indexOf("?") + 1)).get("next");
  assert.equal(next, "/dashboard");
});
