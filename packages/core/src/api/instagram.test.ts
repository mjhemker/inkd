// Offline unit tests for the pure Instagram helpers + the connection state
// machine + the HTTP-status→error-kind map. No network, no client.
//
// instagram.ts has a non-type-only runtime import (`./helpers`) with a
// bundler-style extensionless specifier, so run this through the resolve hook:
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     packages/core/src/api/instagram.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IG_IMPORT_MAX,
  InstagramError,
  instagramErrorKindForStatus,
  isImportSelectable,
  canSelectMore,
  remainingSelectable,
  capSelectionIds,
  toggleSelection,
  selectAllOnPage,
  assertImportBatch,
  selectionCapMessage,
  buildCompletionMessage,
  buildPiecesAddedMessage,
  deriveInstagramState,
  type InstagramMediaItem,
} from "./instagram.ts";

function item(overrides: Partial<InstagramMediaItem> = {}): InstagramMediaItem {
  return {
    id: overrides.id ?? "m1",
    caption: null,
    media_type: "IMAGE",
    permalink: null,
    timestamp: null,
    preview_url: null,
    child_count: 0,
    importable: true,
    already_imported: false,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Error-kind mapping
// --------------------------------------------------------------------------
test("instagramErrorKindForStatus maps documented statuses", () => {
  assert.equal(instagramErrorKindForStatus(404), "notConnected");
  assert.equal(instagramErrorKindForStatus(409), "tokenExpired");
  assert.equal(instagramErrorKindForStatus(503), "comingSoon");
  assert.equal(instagramErrorKindForStatus(403), "forbidden");
  assert.equal(instagramErrorKindForStatus(401), "error");
  assert.equal(instagramErrorKindForStatus(500), "error");
  assert.equal(instagramErrorKindForStatus(undefined), "error");
});

test("InstagramError carries kind/status/code", () => {
  const e = new InstagramError("tokenExpired", "expired", { status: 409, code: "conflict" });
  assert.ok(e instanceof Error);
  assert.equal(e.kind, "tokenExpired");
  assert.equal(e.status, 409);
  assert.equal(e.code, "conflict");
});

// --------------------------------------------------------------------------
// Selection cap logic
// --------------------------------------------------------------------------
test("isImportSelectable respects importable + already_imported", () => {
  assert.equal(isImportSelectable(item()), true);
  assert.equal(isImportSelectable(item({ importable: false })), false);
  assert.equal(isImportSelectable(item({ already_imported: true })), false);
});

test("canSelectMore / remainingSelectable honor the cap", () => {
  assert.equal(canSelectMore(0), true);
  assert.equal(canSelectMore(IG_IMPORT_MAX - 1), true);
  assert.equal(canSelectMore(IG_IMPORT_MAX), false);
  assert.equal(remainingSelectable(0), IG_IMPORT_MAX);
  assert.equal(remainingSelectable(IG_IMPORT_MAX), 0);
  assert.equal(remainingSelectable(IG_IMPORT_MAX + 5), 0);
});

test("capSelectionIds keeps the first 50", () => {
  const ids = Array.from({ length: 73 }, (_, i) => `m${i}`);
  const capped = capSelectionIds(ids);
  assert.equal(capped.length, IG_IMPORT_MAX);
  assert.equal(capped[0], "m0");
  assert.equal(capped[49], "m49");
});

test("toggleSelection adds, removes, and no-ops correctly", () => {
  // add
  assert.deepEqual(toggleSelection([], item({ id: "a" })), ["a"]);
  // remove
  assert.deepEqual(toggleSelection(["a", "b"], item({ id: "a" })), ["b"]);
  // ineligible → no-op add
  assert.deepEqual(toggleSelection(["a"], item({ id: "x", importable: false })), ["a"]);
  assert.deepEqual(toggleSelection(["a"], item({ id: "y", already_imported: true })), ["a"]);
  // but removing an already-selected item works even if now ineligible
  assert.deepEqual(toggleSelection(["z"], item({ id: "z", importable: false })), []);
  // cap reached → no-op add
  const full = Array.from({ length: IG_IMPORT_MAX }, (_, i) => `m${i}`);
  assert.equal(toggleSelection(full, item({ id: "new" })).length, IG_IMPORT_MAX);
});

test("toggleSelection never mutates the input", () => {
  const input = ["a"];
  const out = toggleSelection(input, item({ id: "b" }));
  assert.deepEqual(input, ["a"]);
  assert.deepEqual(out, ["a", "b"]);
});

test("selectAllOnPage appends eligible items up to the cap, deduped", () => {
  const page = [
    item({ id: "a" }),
    item({ id: "b", importable: false }),
    item({ id: "c", already_imported: true }),
    item({ id: "d" }),
    item({ id: "a" }), // dup
  ];
  assert.deepEqual(selectAllOnPage([], page), ["a", "d"]);
  assert.deepEqual(selectAllOnPage(["d"], page), ["d", "a"]);

  const big = Array.from({ length: 60 }, (_, i) => item({ id: `m${i}` }));
  assert.equal(selectAllOnPage([], big).length, IG_IMPORT_MAX);
});

test("assertImportBatch validates size + dedupes", () => {
  assert.throws(() => assertImportBatch([]), RangeError);
  assert.throws(
    () => assertImportBatch(Array.from({ length: 51 }, (_, i) => `m${i}`)),
    RangeError,
  );
  assert.deepEqual(assertImportBatch(["a", "a", "b"]), ["a", "b"]);
  assert.equal(assertImportBatch(Array.from({ length: 50 }, (_, i) => `m${i}`)).length, 50);
});

test("selectionCapMessage reflects count + cap", () => {
  assert.match(selectionCapMessage(0), /0 posts selected/);
  assert.match(selectionCapMessage(1), /1 post selected/);
  assert.match(selectionCapMessage(3), /3 posts selected/);
  assert.match(selectionCapMessage(IG_IMPORT_MAX), /max per import/i);
});

// --------------------------------------------------------------------------
// Completion / confirmation copy
// --------------------------------------------------------------------------
test("buildCompletionMessage pluralizes correctly", () => {
  assert.equal(
    buildCompletionMessage({ posts_created: 3, media_skipped: 1, already_imported: 2 }),
    "3 posts imported, 1 skipped, 2 were already in your portfolio",
  );
  assert.equal(
    buildCompletionMessage({ posts_created: 1, media_skipped: 0, already_imported: 1 }),
    "1 post imported, 0 skipped, 1 was already in your portfolio",
  );
});

test("buildPiecesAddedMessage pluralizes", () => {
  assert.equal(buildPiecesAddedMessage({ pieces_created: 1 }), "1 piece added to your portfolio");
  assert.equal(buildPiecesAddedMessage({ pieces_created: 5 }), "5 pieces added to your portfolio");
});

// --------------------------------------------------------------------------
// Connection state machine
// --------------------------------------------------------------------------
function status(overrides: Record<string, unknown> = {}) {
  return {
    connected: true,
    ig_username: "hemkerart",
    connected_at: "2026-07-20T00:00:00Z",
    last_synced_at: "2026-07-21T00:00:00Z",
    token_expired: false,
    ...overrides,
  } as never;
}

test("deriveInstagramState: loading when no data + no error", () => {
  assert.deepEqual(
    deriveInstagramState({ data: undefined, error: null, isLoading: true }),
    { kind: "loading" },
  );
});

test("deriveInstagramState: connected", () => {
  const s = deriveInstagramState({ data: status(), error: null, isLoading: false });
  assert.equal(s.kind, "connected");
  if (s.kind === "connected") {
    assert.equal(s.username, "hemkerart");
    assert.equal(s.lastSyncedAt, "2026-07-21T00:00:00Z");
  }
});

test("deriveInstagramState: notConnected when connected:false", () => {
  assert.deepEqual(
    deriveInstagramState({ data: status({ connected: false }), error: null, isLoading: false }),
    { kind: "notConnected" },
  );
});

test("deriveInstagramState: tokenExpired when token_expired:true", () => {
  assert.deepEqual(
    deriveInstagramState({ data: status({ token_expired: true }), error: null, isLoading: false }),
    { kind: "tokenExpired" },
  );
});

test("deriveInstagramState: comingSoon from 503 error and from legacy configured:false", () => {
  assert.deepEqual(
    deriveInstagramState({
      data: undefined,
      error: new InstagramError("comingSoon", "nope", { status: 503 }),
      isLoading: false,
    }),
    { kind: "comingSoon" },
  );
  assert.deepEqual(
    deriveInstagramState({ data: status({ configured: false }), error: null, isLoading: false }),
    { kind: "comingSoon" },
  );
});

test("deriveInstagramState: forbidden + generic error", () => {
  assert.deepEqual(
    deriveInstagramState({
      data: undefined,
      error: new InstagramError("forbidden", "no artist", { status: 403 }),
      isLoading: false,
    }),
    { kind: "forbidden" },
  );
  const e = deriveInstagramState({
    data: undefined,
    error: new Error("boom"),
    isLoading: false,
  });
  assert.equal(e.kind, "error");
  if (e.kind === "error") assert.equal(e.message, "boom");
});
