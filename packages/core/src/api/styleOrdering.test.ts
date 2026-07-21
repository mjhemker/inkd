// Offline unit tests for the pure style-ordering helpers (SPEC round 6, item 4).
// Runs under Node's built-in runner with type-stripping (Node >= 22.6):
//   node --test packages/core/src/api/styleOrdering.test.ts
//
// styleOrdering.ts imports only a *type* from ./types, so it strips cleanly
// under the native loader (unlike feedFilters.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  rankStyles,
  collapsedStyleCount,
  addRecentStyles,
  parseRecentStyles,
  STYLE_CHIP_COLLAPSED_COUNT,
  MAX_RECENT_STYLES,
} from "./styleOrdering.ts";
import type { Style } from "../types/rows";

/** Build a minimal Style row from a slug (taxonomy order = array order). */
function style(slug: string): Style {
  return {
    id: slug,
    slug,
    name: slug,
    category: null,
    description: null,
    sort_order: 0,
    created_at: "",
  } as Style;
}

const TAXONOMY = ["traditional", "fine-line", "blackwork", "realism", "japanese", "dotwork", "tribal"].map(
  style,
);
const slugs = (list: Style[]) => list.map((s) => s.slug);

test("rankStyles: taxonomy order is preserved when there are no signals", () => {
  assert.deepEqual(slugs(rankStyles(TAXONOMY, {})), slugs(TAXONOMY));
});

test("rankStyles: selected styles come first, in selection order", () => {
  const out = rankStyles(TAXONOMY, { selected: ["japanese", "traditional"] });
  assert.deepEqual(slugs(out).slice(0, 2), ["japanese", "traditional"]);
});

test("rankStyles: bands order selected > preferred > recent > rest", () => {
  const out = slugs(
    rankStyles(TAXONOMY, {
      selected: ["realism"],
      preferred: ["tribal"],
      recent: ["dotwork"],
    }),
  );
  assert.equal(out[0], "realism"); // selected
  assert.equal(out[1], "tribal"); // preferred
  assert.equal(out[2], "dotwork"); // recent
  // The remaining taxonomy keeps its incoming order after the ranked ones.
  assert.deepEqual(out.slice(3), ["traditional", "fine-line", "blackwork", "japanese"]);
});

test("rankStyles: a slug in several inputs takes its strongest (selected) band", () => {
  const out = slugs(
    rankStyles(TAXONOMY, { selected: ["dotwork"], preferred: ["dotwork"], recent: ["dotwork"] }),
  );
  assert.equal(out[0], "dotwork");
  assert.equal(new Set(out).size, out.length, "no duplicates");
});

test("rankStyles: recent list keeps most-recent-first order", () => {
  const out = slugs(rankStyles(TAXONOMY, { recent: ["tribal", "fine-line"] }));
  assert.deepEqual(out.slice(0, 2), ["tribal", "fine-line"]);
});

test("rankStyles: does not mutate its input array", () => {
  const before = slugs(TAXONOMY);
  rankStyles(TAXONOMY, { selected: ["realism"] });
  assert.deepEqual(slugs(TAXONOMY), before);
});

test("collapsedStyleCount: default is the base count", () => {
  assert.equal(collapsedStyleCount(0), STYLE_CHIP_COLLAPSED_COUNT);
  assert.equal(collapsedStyleCount(3), STYLE_CHIP_COLLAPSED_COUNT);
});

test("collapsedStyleCount: never hides a selected chip", () => {
  assert.equal(collapsedStyleCount(9), 9);
});

test("addRecentStyles: prepends, dedupes, keeps most-recent first", () => {
  let list: string[] = [];
  list = addRecentStyles(list, ["fine-line"]);
  list = addRecentStyles(list, ["blackwork"]);
  list = addRecentStyles(list, ["fine-line"]); // touch again → back to front
  assert.deepEqual(list, ["fine-line", "blackwork"]);
});

test("addRecentStyles: a multi-slug batch ends most-recent-last-wins", () => {
  const list = addRecentStyles([], ["a", "b", "c"]);
  assert.deepEqual(list, ["c", "b", "a"]);
});

test("addRecentStyles: caps at MAX_RECENT_STYLES", () => {
  const many = Array.from({ length: MAX_RECENT_STYLES + 5 }, (_, i) => `s${i}`);
  const list = addRecentStyles([], many);
  assert.equal(list.length, MAX_RECENT_STYLES);
});

test("addRecentStyles: ignores blanks", () => {
  assert.deepEqual(addRecentStyles([], ["", "  ", "ok"]), ["ok"]);
});

test("parseRecentStyles: round-trips a valid blob and rejects junk", () => {
  assert.deepEqual(parseRecentStyles(JSON.stringify(["a", "b"])), ["a", "b"]);
  assert.deepEqual(parseRecentStyles(null), []);
  assert.deepEqual(parseRecentStyles("not json"), []);
  assert.deepEqual(parseRecentStyles(JSON.stringify([1, "ok", null, ""])), ["ok"]);
});
