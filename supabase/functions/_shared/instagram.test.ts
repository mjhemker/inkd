// Offline unit tests for the Instagram OAuth helpers. Runs with zero
// dependencies under Node's built-in runner:
//   node --test supabase/functions/_shared/instagram.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthorizeUrl,
  signState,
  verifyState,
  IG_SCOPES,
  IG_AUTHORIZE_URL,
} from "./instagram.ts";

test("buildAuthorizeUrl: includes client_id, redirect_uri, scope, state", () => {
  const url = buildAuthorizeUrl({
    appId: "123456",
    redirectUri: "https://getinkd.co/functions/v1/instagram-oauth",
    state: "abc.def",
  });
  const parsed = new URL(url);
  assert.equal(`${parsed.origin}${parsed.pathname}`, IG_AUTHORIZE_URL);
  assert.equal(parsed.searchParams.get("client_id"), "123456");
  assert.equal(
    parsed.searchParams.get("redirect_uri"),
    "https://getinkd.co/functions/v1/instagram-oauth",
  );
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("scope"), IG_SCOPES.join(","));
  assert.equal(parsed.searchParams.get("state"), "abc.def");
});

test("buildAuthorizeUrl: only requests instagram_business_basic by default", () => {
  const url = buildAuthorizeUrl({
    appId: "1",
    redirectUri: "https://getinkd.co/cb",
    state: "s",
  });
  const scope = new URL(url).searchParams.get("scope");
  assert.equal(scope, "instagram_business_basic");
});

test("signState/verifyState: valid roundtrip resolves the artist id", async () => {
  const secret = "test-secret-1";
  const state = await signState(
    { artistId: "artist-1", nonce: "n1", expiresAt: Date.now() + 60_000 },
    secret,
  );
  const result = await verifyState(state, secret);
  assert.equal(result.valid, true);
  assert.equal(result.artistId, "artist-1");
});

test("verifyState: rejects a tampered signature", async () => {
  const secret = "test-secret-1";
  const state = await signState(
    { artistId: "artist-1", nonce: "n1", expiresAt: Date.now() + 60_000 },
    secret,
  );
  const tampered = `${state.slice(0, -4)}xxxx`;
  const result = await verifyState(tampered, secret);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature");
});

test("verifyState: rejects a state signed with a different secret", async () => {
  const state = await signState(
    { artistId: "artist-1", nonce: "n1", expiresAt: Date.now() + 60_000 },
    "secret-a",
  );
  const result = await verifyState(state, "secret-b");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature");
});

test("verifyState: rejects an expired state", async () => {
  const secret = "test-secret-1";
  const state = await signState(
    { artistId: "artist-1", nonce: "n1", expiresAt: Date.now() - 1_000 },
    secret,
  );
  const result = await verifyState(state, secret);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "expired");
  // Still resolves the artist id so the caller can log/alert on stale callbacks.
  assert.equal(result.artistId, "artist-1");
});

test("verifyState: rejects malformed input", async () => {
  const result = await verifyState("not-a-valid-state-token", "secret");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed");
});

test("verifyState: rejects an empty string", async () => {
  const result = await verifyState("", "secret");
  assert.equal(result.valid, false);
});

test("signState: two calls with different nonces produce different states", async () => {
  const secret = "test-secret-1";
  const expiresAt = Date.now() + 60_000;
  const a = await signState({ artistId: "artist-1", nonce: "n1", expiresAt }, secret);
  const b = await signState({ artistId: "artist-1", nonce: "n2", expiresAt }, secret);
  assert.notEqual(a, b);
});
