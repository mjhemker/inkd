// Offline unit tests for the Instagram status + disconnect response shaping.
// Runs with zero dependencies under Node's built-in runner:
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     supabase/functions/_shared/ig-status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { shapeStatusResponse, DISCONNECT_RESPONSE } from "./ig-status.ts";

const NOW = Date.parse("2026-07-21T00:00:00.000Z");

test("shapeStatusResponse: not connected (null row) → connected:false, all nulls", () => {
  const res = shapeStatusResponse(null, NOW);
  assert.deepEqual(res, {
    connected: false,
    ig_username: null,
    connected_at: null,
    last_synced_at: null,
    token_expired: false,
  });
});

test("shapeStatusResponse: undefined row behaves like not connected", () => {
  const res = shapeStatusResponse(undefined, NOW);
  assert.equal(res.connected, false);
  assert.equal(res.token_expired, false);
});

test("shapeStatusResponse: connected, unexpired token", () => {
  const res = shapeStatusResponse(
    {
      ig_username: "hemkerart",
      connected_at: "2026-07-21T00:00:00.000Z",
      last_synced_at: "2026-07-21T00:05:00.000Z",
      token_expires_at: "2026-09-19T00:00:00.000Z",
    },
    NOW,
  );
  assert.deepEqual(res, {
    connected: true,
    ig_username: "hemkerart",
    connected_at: "2026-07-21T00:00:00.000Z",
    last_synced_at: "2026-07-21T00:05:00.000Z",
    token_expired: false,
  });
});

test("shapeStatusResponse: connected, expired token → token_expired:true", () => {
  const res = shapeStatusResponse(
    { ig_username: "hemkerart", token_expires_at: "2026-07-20T23:59:59.000Z" },
    NOW,
  );
  assert.equal(res.connected, true);
  assert.equal(res.token_expired, true);
});

test("shapeStatusResponse: never leaks a token field", () => {
  const res = shapeStatusResponse(
    // deliberately pass an extra token field; shaping must drop it
    { ig_username: "x", token_expires_at: "2026-09-19T00:00:00.000Z", access_token: "SECRET" } as never,
    NOW,
  );
  assert.equal("access_token" in res, false);
  assert.deepEqual(Object.keys(res).sort(), [
    "connected",
    "connected_at",
    "ig_username",
    "last_synced_at",
    "token_expired",
  ]);
});

test("shapeStatusResponse: missing token_expires_at is treated as not expired", () => {
  const res = shapeStatusResponse({ ig_username: "x" }, NOW);
  assert.equal(res.connected, true);
  assert.equal(res.token_expired, false);
});

test("shapeStatusResponse: connected row with null username coalesces to null", () => {
  const res = shapeStatusResponse({ ig_username: null, connected_at: "2026-07-21T00:00:00.000Z" }, NOW);
  assert.equal(res.connected, true);
  assert.equal(res.ig_username, null);
});

test("DISCONNECT_RESPONSE: exact idempotent shape", () => {
  assert.deepEqual(DISCONNECT_RESPONSE, { ok: true, disconnected: true });
});
