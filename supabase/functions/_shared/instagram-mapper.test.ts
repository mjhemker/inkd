// Offline unit tests for the IG media -> INKD post/piece mapper. Runs with
// zero dependencies under Node's built-in runner:
//   node --test supabase/functions/_shared/instagram-mapper.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mapInstagramMedia,
  filterAlreadyImported,
  inferImageExtension,
  buildPortfolioPieceInsert,
} from "./instagram-mapper.ts";
import type { IgMediaItem } from "./instagram.ts";

function media(overrides: Partial<IgMediaItem> = {}): IgMediaItem {
  return {
    id: "ig-1",
    caption: "Fresh blackwork sleeve, healed 6 weeks.",
    media_type: "IMAGE",
    media_url: "https://cdn.instagram.com/ig-1.jpg",
    thumbnail_url: null,
    permalink: "https://instagram.com/p/ig-1",
    timestamp: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

test("mapInstagramMedia: maps an image post", () => {
  const [mapped] = mapInstagramMedia([media()]);
  assert.equal(mapped!.skip, false);
  assert.equal(mapped!.mediaId, "ig-1");
  assert.equal(mapped!.sourceImageUrl, "https://cdn.instagram.com/ig-1.jpg");
  assert.deepEqual(mapped!.post, {
    caption: "Fresh blackwork sleeve, healed 6 weeks.",
    source: "instagram",
    instagram_id: "ig-1",
    instagram_permalink: "https://instagram.com/p/ig-1",
    is_public: true,
  });
});

test("mapInstagramMedia: video uses thumbnail_url as the source image", () => {
  const [mapped] = mapInstagramMedia([
    media({
      id: "ig-vid",
      media_type: "VIDEO",
      media_url: null,
      thumbnail_url: "https://cdn.instagram.com/ig-vid-thumb.jpg",
    }),
  ]);
  assert.equal(mapped!.skip, false);
  assert.equal(mapped!.sourceImageUrl, "https://cdn.instagram.com/ig-vid-thumb.jpg");
});

test("mapInstagramMedia: video without a thumbnail is skipped, not thrown", () => {
  const [mapped] = mapInstagramMedia([
    media({ id: "ig-vid-2", media_type: "VIDEO", media_url: null, thumbnail_url: null }),
  ]);
  assert.equal(mapped!.skip, true);
  assert.equal(mapped!.skipReason, "no_image_source");
  // Still carries the post shape so the caller can log what it skipped.
  assert.equal(mapped!.post.instagram_id, "ig-vid-2");
});

test("mapInstagramMedia: carousel album falls back to media_url", () => {
  const [mapped] = mapInstagramMedia([
    media({ id: "ig-car", media_type: "CAROUSEL_ALBUM", media_url: "https://cdn.instagram.com/cover.jpg" }),
  ]);
  assert.equal(mapped!.skip, false);
  assert.equal(mapped!.sourceImageUrl, "https://cdn.instagram.com/cover.jpg");
});

test("mapInstagramMedia: empty caption normalizes to null", () => {
  const [mapped] = mapInstagramMedia([media({ caption: "   " })]);
  assert.equal(mapped!.post.caption, null);
});

test("mapInstagramMedia: missing caption normalizes to null", () => {
  const [mapped] = mapInstagramMedia([media({ caption: null })]);
  assert.equal(mapped!.post.caption, null);
});

test("mapInstagramMedia: caption is trimmed and length-capped", () => {
  const [mapped] = mapInstagramMedia([media({ caption: `  ${"x".repeat(5000)}  ` })]);
  assert.equal(mapped!.post.caption!.length, 4000);
});

test("mapInstagramMedia: processes a full page independently (one bad item doesn't drop the rest)", () => {
  const results = mapInstagramMedia([
    media({ id: "ig-good" }),
    media({ id: "ig-bad", media_type: "VIDEO", media_url: null, thumbnail_url: null }),
    media({ id: "ig-good-2" }),
  ]);
  assert.equal(results.length, 3);
  assert.equal(results.filter((r) => !r.skip).length, 2);
  assert.equal(results.filter((r) => r.skip).length, 1);
});

test("filterAlreadyImported: drops media ids already imported", () => {
  const items = [media({ id: "a" }), media({ id: "b" }), media({ id: "c" })];
  const result = filterAlreadyImported(items, new Set(["b"]));
  assert.deepEqual(
    result.map((i) => i.id),
    ["a", "c"],
  );
});

test("filterAlreadyImported: empty set keeps everything", () => {
  const items = [media({ id: "a" }), media({ id: "b" })];
  assert.equal(filterAlreadyImported(items, new Set()).length, 2);
});

test("filterAlreadyImported: idempotent — running twice with the same set converges to empty", () => {
  const items = [media({ id: "a" }), media({ id: "b" })];
  const alreadyImported = new Set(items.map((i) => i.id));
  assert.equal(filterAlreadyImported(items, alreadyImported).length, 0);
});

test("inferImageExtension: reads the extension off the CDN URL", () => {
  assert.equal(inferImageExtension("https://cdn.instagram.com/foo.jpg"), "jpg");
  assert.equal(inferImageExtension("https://cdn.instagram.com/foo.jpeg"), "jpg");
  assert.equal(inferImageExtension("https://cdn.instagram.com/foo.png?x=1"), "png");
  assert.equal(inferImageExtension("https://cdn.instagram.com/foo.webp"), "webp");
});

test("inferImageExtension: falls back to content-type, then jpg", () => {
  assert.equal(inferImageExtension("https://cdn.instagram.com/opaque-id", "image/png"), "png");
  assert.equal(inferImageExtension("https://cdn.instagram.com/opaque-id"), "jpg");
});

test("buildPortfolioPieceInsert: shapes the insert row", () => {
  const row = buildPortfolioPieceInsert({
    mediaId: "ig-1",
    postId: "post-uuid",
    imageUrl: "https://media.getinkd.co/artist/portfolio/ig-1.jpg",
    sortOrder: 3,
  });
  assert.deepEqual(row, {
    post_id: "post-uuid",
    instagram_media_id: "ig-1",
    image_url: "https://media.getinkd.co/artist/portfolio/ig-1.jpg",
    is_public: true,
    sort_order: 3,
  });
});
