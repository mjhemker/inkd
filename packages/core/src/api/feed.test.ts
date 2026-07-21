// Offline unit tests for the feed's "Other" free-text style query matcher
// (round-5 founder feedback: a way to search for a style outside the
// taxonomy — see feedFilters.ts's `styleQuery`). This is a pure function with
// no Supabase client dependency, so it's covered directly rather than via
// `listFeedItems` (which needs a live/mock client).
//
// Like feedFilters.test.ts, this can't run under bare `node --test` — feed.ts
// has real runtime imports from ./helpers that Node's native loader can't
// resolve without an extension mobile/web's typecheck won't tolerate. Run it
// through a TS-resolving runner instead, e.g.:
//   pnpm --filter web exec vitest run ../../packages/core/src/api/feed.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesStyleQuery, type FeedPostItem, type FeedFlashItem } from "./feed.ts";

function post(overrides: Partial<FeedPostItem> = {}): FeedPostItem {
  return {
    kind: "post",
    key: "post:1",
    id: "1",
    createdAt: "2026-07-17T00:00:00Z",
    coverUrl: null,
    caption: null,
    styleTags: [],
    likeCount: 0,
    likedByViewer: false,
    savedByViewer: false,
    source: "native",
    instagramPermalink: null,
    artist: {
      artistId: "a1",
      profileId: "p1",
      handle: "artist",
      displayName: "Artist",
      avatarUrl: null,
      city: null,
      state: null,
      styles: [],
      acceptsNewClients: true,
      isFollowedByViewer: false,
    },
    ...overrides,
  };
}

test("matchesStyleQuery: matches a taxonomy style tag name (case-insensitive)", () => {
  const item = post({ styleTags: [{ id: "s1", slug: "fine-line", name: "Fine Line" }] });
  assert.equal(matchesStyleQuery(item, "fine line"), true);
  assert.equal(matchesStyleQuery(item, "FINE"), true);
  assert.equal(matchesStyleQuery(item, "realism"), false);
});

test("matchesStyleQuery: matches the artist's free-text styles (for 'Other' styles outside the taxonomy)", () => {
  const item = post({
    artist: { ...post().artist, styles: ["Chicano", "Black & Grey"] },
  });
  assert.equal(matchesStyleQuery(item, "chicano"), true);
  assert.equal(matchesStyleQuery(item, "chican"), true, "substring match");
  assert.equal(matchesStyleQuery(item, "japanese"), false);
});

test("matchesStyleQuery: matches a post caption", () => {
  const item = post({ caption: "Fresh chicano piece, healed 6 weeks" });
  assert.equal(matchesStyleQuery(item, "chicano"), true);
  assert.equal(matchesStyleQuery(item, "healed"), true);
  assert.equal(matchesStyleQuery(item, "traditional"), false);
});

test("matchesStyleQuery: flash items have no caption field but still match style tags/artist styles", () => {
  const flash: FeedFlashItem = {
    kind: "flash",
    key: "flash:1",
    id: "1",
    flashSheetId: "fs1",
    createdAt: "2026-07-17T00:00:00Z",
    imageUrl: null,
    title: "Chicano skull",
    priceCents: 20000,
    isAvailable: true,
    isRepeatable: false,
    placementSuggestion: null,
    sizeInches: null,
    styleTags: [{ id: "s1", slug: "chicano", name: "Chicano" }],
    artist: post().artist,
  };
  assert.equal(matchesStyleQuery(flash, "chicano"), true);
  assert.equal(matchesStyleQuery(flash, "skull"), false, "title isn't part of the matched surface");
});

test("matchesStyleQuery: blank query matches everything (defensive — callers should skip filtering instead)", () => {
  assert.equal(matchesStyleQuery(post(), ""), true);
  assert.equal(matchesStyleQuery(post(), "   "), true);
});
