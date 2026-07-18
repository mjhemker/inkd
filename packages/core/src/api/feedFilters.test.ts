// Offline unit tests for the feed filter panel helpers, in particular the
// "Other" free-text style query added alongside the taxonomy multi-select
// (round-5 founder feedback: a way to search for a style outside the
// taxonomy).
//
// Unlike sibling *.test.ts files (e.g. discover.test.ts), this one can't run
// under bare `node --test`: feedFilters.ts has real (non-type-only) runtime
// imports from ./discover, and Node's native ESM loader requires an explicit
// specifier extension it doesn't have — adding one would in turn break
// mobile/web typecheck, which resolve packages/core's *source* directly and
// don't have `allowImportingTsExtensions` set. Run it through any
// TS-resolving runner instead, e.g.:
//   pnpm --filter web exec vitest run ../../packages/core/src/api/feedFilters.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_FEED_FILTER,
  hasActiveFeedFilters,
  activeFeedFilterCount,
  hasStyleQuery,
  describeFeedFilters,
  clearFeedFilterChip,
  feedFilterToQuery,
  queryToFeedFilter,
  type FeedFilterState,
} from "./feedFilters.ts";
import type { Style } from "../types/rows.ts";

/** A `URLSearchParams`-like getter over a plain record; missing keys -> null. */
function getter(params: Record<string, string> = {}) {
  return (key: string): string | null =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key]! : null;
}

// Only the fields `describeFeedFilters` actually reads (id/slug/name); cast
// through `unknown` to stand in for the full `Style` row shape.
const STYLES = [
  { id: "s1", slug: "fine-line", name: "Fine Line", sort_order: 1 },
  { id: "s2", slug: "realism", name: "Realism", sort_order: 2 },
] as unknown as Style[];

// ---------------------------------------------------------------------------
// hasStyleQuery / hasActiveFeedFilters / activeFeedFilterCount
// ---------------------------------------------------------------------------
test("hasStyleQuery: blank/whitespace-only query is not active", () => {
  assert.equal(hasStyleQuery({ ...EMPTY_FEED_FILTER, styleQuery: undefined }), false);
  assert.equal(hasStyleQuery({ ...EMPTY_FEED_FILTER, styleQuery: "" }), false);
  assert.equal(hasStyleQuery({ ...EMPTY_FEED_FILTER, styleQuery: "   " }), false);
  assert.equal(hasStyleQuery({ ...EMPTY_FEED_FILTER, styleQuery: "chicano" }), true);
});

test("hasActiveFeedFilters / activeFeedFilterCount: a styleQuery alone counts as one active filter", () => {
  const f: FeedFilterState = { ...EMPTY_FEED_FILTER, styleQuery: "chicano" };
  assert.equal(hasActiveFeedFilters(f), true);
  assert.equal(activeFeedFilterCount(f), 1);
});

test("EMPTY_FEED_FILTER has no active filters (styleQuery included)", () => {
  assert.equal(hasActiveFeedFilters(EMPTY_FEED_FILTER), false);
  assert.equal(activeFeedFilterCount(EMPTY_FEED_FILTER), 0);
});

// ---------------------------------------------------------------------------
// describeFeedFilters / clearFeedFilterChip
// ---------------------------------------------------------------------------
test("describeFeedFilters: styleQuery renders as its own chip after style chips", () => {
  const f: FeedFilterState = { ...EMPTY_FEED_FILTER, styles: ["realism"], styleQuery: "chicano" };
  const chips = describeFeedFilters(f, STYLES);
  assert.equal(chips.length, 2);
  assert.equal(chips[0]!.kind, "style");
  assert.equal(chips[1]!.kind, "styleQuery");
  assert.equal(chips[1]!.label, 'Other: "chicano"');
});

test("clearFeedFilterChip: clearing the styleQuery chip only clears styleQuery", () => {
  const f: FeedFilterState = { ...EMPTY_FEED_FILTER, styles: ["realism"], styleQuery: "chicano" };
  const chips = describeFeedFilters(f, STYLES);
  const styleQueryChip = chips.find((c) => c.kind === "styleQuery")!;
  const next = clearFeedFilterChip(f, styleQueryChip);
  assert.equal(next.styleQuery, undefined);
  assert.deepEqual(next.styles, ["realism"]);
});

// ---------------------------------------------------------------------------
// URL (de)serialization — round-trips through the `styleOther` param.
// ---------------------------------------------------------------------------
test("feedFilterToQuery / queryToFeedFilter: styleQuery round-trips through the URL", () => {
  const f: FeedFilterState = { ...EMPTY_FEED_FILTER, styles: ["realism"], styleQuery: "chicano " };
  const qs = feedFilterToQuery(f);
  assert.ok(qs.includes("styleOther=chicano"));
  const parsed = new URLSearchParams(qs);
  const back = queryToFeedFilter((k) => parsed.get(k));
  assert.equal(back.styleQuery, "chicano");
  assert.deepEqual(back.styles, ["realism"]);
});

test("queryToFeedFilter: empty URL yields no styleQuery", () => {
  const f = queryToFeedFilter(getter({}));
  assert.equal(f.styleQuery, undefined);
});

test("feedFilterToQuery: a blank styleQuery is omitted from the URL", () => {
  const f: FeedFilterState = { ...EMPTY_FEED_FILTER, styleQuery: "   " };
  const qs = feedFilterToQuery(f);
  assert.equal(qs.includes("styleOther"), false);
});
