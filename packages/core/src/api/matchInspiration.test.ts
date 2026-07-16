// Offline unit tests for the pure "match my inspiration" presentation logic:
// the grouping/ranking of similar_works neighbors, the plain-language match
// reason, the "what INKD saw" summary, and the outcome classification that
// drives graceful degradation (no readable style / no matches / weak matches).
//
//   node --test packages/core/src/api/matchInspiration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  describeInspiration,
  groupSimilarWorks,
  classifyMatchOutcome,
  buildMatchReason,
  matchStrengthLabel,
  similarityToPercent,
  formatStyleLabel,
  workHref,
  hasAnyDiscoverFilter,
  STYLE_CLARITY_THRESHOLD,
  type ArtistBrief,
  type InspirationSummary,
} from "./matchInspiration.ts";
import type { ImageTagResult, SimilarWork } from "./similarWorks.ts";

function tags(over: Partial<ImageTagResult> = {}): ImageTagResult {
  return {
    styles: [{ slug: "fine-line", confidence: 0.9 }],
    placement: ["forearm"],
    color_type: "black_grey",
    size_estimate: "medium",
    subject_matter: ["rose"],
    description: "a delicate rose",
    ...over,
  };
}

function work(over: Partial<SimilarWork>): SimilarWork {
  return {
    subject_type: "portfolio_piece",
    subject_id: "s1",
    artist_id: "a1",
    image_url: "https://img/1.jpg",
    styles: ["fine-line"],
    color_type: "black_grey",
    similarity: 0.8,
    ...over,
  };
}

function artistMap(entries: Partial<ArtistBrief>[]): Map<string, ArtistBrief> {
  const m = new Map<string, ArtistBrief>();
  for (const e of entries) {
    const b: ArtistBrief = {
      artistId: e.artistId ?? "a",
      profileId: e.profileId ?? "p",
      handle: "handle" in e ? (e.handle ?? null) : "handle",
      displayName: e.displayName ?? "Artist",
      avatarUrl: e.avatarUrl ?? null,
    };
    m.set(b.artistId, b);
  }
  return m;
}

// --- formatting -------------------------------------------------------------
test("formatStyleLabel title-cases slugs", () => {
  assert.equal(formatStyleLabel("fine-line"), "Fine Line");
  assert.equal(formatStyleLabel("floral-botanical"), "Floral Botanical");
});

test("similarityToPercent clamps and rounds", () => {
  assert.equal(similarityToPercent(0.826), 83);
  assert.equal(similarityToPercent(1.5), 100);
  assert.equal(similarityToPercent(-0.2), 0);
  assert.equal(similarityToPercent(Number.NaN), 0);
});

test("matchStrengthLabel maps score bands", () => {
  assert.equal(matchStrengthLabel(0.9), "Strong match");
  assert.equal(matchStrengthLabel(0.6), "Close match");
  assert.equal(matchStrengthLabel(0.4), "Loose match");
  assert.equal(matchStrengthLabel(0.1), "Related");
});

// --- describeInspiration ----------------------------------------------------
test("describeInspiration sorts styles by confidence and flags clarity", () => {
  const s = describeInspiration(
    tags({
      styles: [
        { slug: "floral-botanical", confidence: 0.5 },
        { slug: "fine-line", confidence: 0.95 },
      ],
    }),
  );
  assert.equal(s.styles[0]!.slug, "fine-line");
  assert.equal(s.styles[1]!.slug, "floral-botanical");
  assert.equal(s.hasClearStyle, true);
  assert.equal(s.colorLabel, "Black & grey");
});

test("describeInspiration marks no clear style when confidence is low", () => {
  const s = describeInspiration(
    tags({ styles: [{ slug: "fine-line", confidence: STYLE_CLARITY_THRESHOLD - 0.05 }] }),
  );
  assert.equal(s.hasClearStyle, false);
});

test("describeInspiration marks no clear style when there are no styles", () => {
  const s = describeInspiration(tags({ styles: [] }));
  assert.equal(s.hasClearStyle, false);
  assert.equal(s.styles.length, 0);
});

// --- buildMatchReason -------------------------------------------------------
test("buildMatchReason prefers shared inspiration styles", () => {
  assert.equal(
    buildMatchReason(["Fine Line", "Floral Botanical"], ["Blackwork"], "Black & grey"),
    "Fine Line + Floral Botanical, like your inspiration",
  );
});

test("buildMatchReason falls back to the artist's own styles, then color", () => {
  assert.equal(
    buildMatchReason([], ["Blackwork", "Dotwork"], "Color"),
    "Blackwork + Dotwork — a related aesthetic",
  );
  assert.equal(buildMatchReason([], [], "Color"), "Similar color work");
});

// --- groupSimilarWorks ------------------------------------------------------
test("groups by artist, ranks by best piece, caps works per artist", () => {
  const rows: SimilarWork[] = [
    work({ artist_id: "a1", subject_id: "w1", similarity: 0.6 }),
    work({ artist_id: "a1", subject_id: "w2", similarity: 0.9 }),
    work({ artist_id: "a1", subject_id: "w3", similarity: 0.7 }),
    work({ artist_id: "a1", subject_id: "w4", similarity: 0.5 }),
    work({ artist_id: "a1", subject_id: "w5", similarity: 0.4 }),
    work({ artist_id: "a2", subject_id: "w6", similarity: 0.95 }),
  ];
  const groups = groupSimilarWorks(rows, artistMap([{ artistId: "a1", handle: "nova" }, { artistId: "a2", handle: "sofia" }]), {
    inspirationStyleSlugs: ["fine-line"],
    inspirationColorLabel: "Black & grey",
    maxWorksPerArtist: 4,
  });
  // a2 ranks first (0.95 > 0.9)
  assert.equal(groups[0]!.artistId, "a2");
  assert.equal(groups[1]!.artistId, "a1");
  // a1 capped to 4 works, sorted desc, top first
  assert.equal(groups[1]!.works.length, 4);
  assert.equal(groups[1]!.works[0]!.subjectId, "w2");
  assert.equal(groups[1]!.topSimilarity, 0.9);
  assert.equal(groups[1]!.topSimilarityPercent, 90);
});

test("group carries a shared-style reason and profile href", () => {
  const rows = [work({ artist_id: "a1", styles: ["fine-line", "floral-botanical"] })];
  const [g] = groupSimilarWorks(rows, artistMap([{ artistId: "a1", handle: "nova", displayName: "Nova" }]), {
    inspirationStyleSlugs: ["fine-line", "floral-botanical"],
    inspirationColorLabel: "Black & grey",
  });
  assert.equal(g!.displayName, "Nova");
  assert.equal(g!.profileHref, "/a/nova");
  assert.deepEqual(g!.sharedStyleLabels, ["Fine Line", "Floral Botanical"]);
  assert.equal(g!.matchReason, "Fine Line + Floral Botanical, like your inspiration");
});

test("group with no handle is non-linking but still rendered", () => {
  const rows = [work({ artist_id: "a1" })];
  const [g] = groupSimilarWorks(rows, artistMap([{ artistId: "a1", handle: null, displayName: "Ghost" }]), {});
  assert.equal(g!.profileHref, null);
  assert.equal(g!.handle, null);
  assert.equal(g!.displayName, "Ghost");
});

test("rows with a null artist_id are dropped", () => {
  const rows = [work({ artist_id: null }), work({ artist_id: "a1" })];
  const groups = groupSimilarWorks(rows, artistMap([{ artistId: "a1" }]), {});
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.artistId, "a1");
});

test("unknown artist falls back to a friendly name", () => {
  const rows = [work({ artist_id: "ghost" })];
  const [g] = groupSimilarWorks(rows, new Map(), {});
  assert.equal(g!.displayName, "INKD artist");
});

// --- workHref ---------------------------------------------------------------
test("workHref deep-links to the right profile section, null without handle", () => {
  const w = groupSimilarWorks([work({ subject_type: "flash_item", subject_id: "f9" })], artistMap([{ artistId: "a1", handle: "nova" }]), {})[0]!.works[0]!;
  assert.equal(workHref("nova", w), "/a/nova#flash-f9");
  assert.equal(workHref(null, w), null);
});

// --- classifyMatchOutcome ---------------------------------------------------
function summary(over: Partial<InspirationSummary> = {}): InspirationSummary {
  return describeInspiration(
    tags(over.hasClearStyle === false ? { styles: [] } : {}),
  );
}

test("outcome: no_style when the image has no readable aesthetic", () => {
  const s = describeInspiration(tags({ styles: [] }));
  assert.equal(classifyMatchOutcome(s, []), "no_style");
});

test("outcome: no_match when a clear style has zero neighbors", () => {
  const s = describeInspiration(tags());
  assert.equal(classifyMatchOutcome(s, []), "no_match");
});

test("outcome: low_match when even the best group is weak", () => {
  const s = describeInspiration(tags());
  const groups = groupSimilarWorks([work({ artist_id: "a1", similarity: 0.42 })], artistMap([{ artistId: "a1" }]), {});
  assert.equal(classifyMatchOutcome(s, groups), "low_match");
});

test("outcome: ok when a confident match exists", () => {
  const s = describeInspiration(tags());
  const groups = groupSimilarWorks([work({ artist_id: "a1", similarity: 0.85 })], artistMap([{ artistId: "a1" }]), {});
  assert.equal(classifyMatchOutcome(s, groups), "ok");
});

// --- hasAnyDiscoverFilter ---------------------------------------------------
test("hasAnyDiscoverFilter detects narrowing filters only", () => {
  assert.equal(hasAnyDiscoverFilter({}), false);
  assert.equal(hasAnyDiscoverFilter({ query: "  " }), false);
  assert.equal(hasAnyDiscoverFilter({ booksOpen: true }), true);
  assert.equal(hasAnyDiscoverFilter({ lat: 39.2, lng: -76.6 }), true);
  assert.equal(hasAnyDiscoverFilter({ styles: ["fine-line"] }), true);
  assert.equal(hasAnyDiscoverFilter({ priceMax: 20000 }), true);
});
