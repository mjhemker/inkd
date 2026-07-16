// Offline unit tests for the AI image-tagging core — tag→slug mapping + the
// deterministic feature-vector builder. Zero dependencies:
//   node --test supabase/functions/_shared/image-tagging.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildImageVector,
  cosineSimilarity,
  mapVisionTags,
  parseVisionResponse,
  STYLE_SLUGS,
  tagsFromVisionResponse,
  toCanonicalPlacement,
  toCanonicalStyle,
  toColorType,
  toPgVectorLiteral,
  toSizeEstimate,
  VECTOR_DIM,
  type ImageTags,
} from "./image-tagging.ts";

// ── tag → canonical slug ────────────────────────────────────────────────────
test("toCanonicalStyle: exact slug passes through", () => {
  assert.equal(toCanonicalStyle("blackwork"), "blackwork");
  assert.equal(toCanonicalStyle("fine-line"), "fine-line");
});

test("toCanonicalStyle: display name and spacing map to slug", () => {
  assert.equal(toCanonicalStyle("Fine Line"), "fine-line");
  assert.equal(toCanonicalStyle("Neo Traditional"), "neo-traditional");
  assert.equal(toCanonicalStyle("Black & Grey"), "black-and-grey");
});

test("toCanonicalStyle: aliases map to canonical slugs", () => {
  assert.equal(toCanonicalStyle("traditional"), "american-traditional");
  assert.equal(toCanonicalStyle("japanese"), "japanese-irezumi");
  assert.equal(toCanonicalStyle("BNG"), "black-and-grey");
  assert.equal(toCanonicalStyle("photorealism"), "realism");
  assert.equal(toCanonicalStyle("sacred geometry"), "geometric");
  assert.equal(toCanonicalStyle("floral"), "floral-botanical");
});

test("toCanonicalStyle: unknown label returns null (dropped, never invented)", () => {
  assert.equal(toCanonicalStyle("steampunk"), null);
  assert.equal(toCanonicalStyle(""), null);
  assert.equal(toCanonicalStyle(null), null);
  assert.equal(toCanonicalStyle(42), null);
});

test("every canonical slug round-trips through toCanonicalStyle", () => {
  for (const s of STYLE_SLUGS) assert.equal(toCanonicalStyle(s), s);
});

// ── placement / color / size ────────────────────────────────────────────────
test("toCanonicalPlacement: vocab, alias, substring, and 'other' fallback", () => {
  assert.equal(toCanonicalPlacement("forearm"), "forearm");
  assert.equal(toCanonicalPlacement("bicep"), "upper-arm");
  assert.equal(toCanonicalPlacement("left forearm"), "forearm");
  assert.equal(toCanonicalPlacement("lower back"), "back");
  assert.equal(toCanonicalPlacement("eyeball"), "other");
});

test("toColorType: maps synonyms and heuristics", () => {
  assert.equal(toColorType("color"), "color");
  assert.equal(toColorType("Full Colour"), "color");
  assert.equal(toColorType("black and grey"), "black_grey");
  assert.equal(toColorType("greyscale"), "black_grey");
  assert.equal(toColorType("both"), "both");
  assert.equal(toColorType("iridescent"), "unknown");
});

test("toSizeEstimate: maps synonyms and substrings", () => {
  assert.equal(toSizeEstimate("small"), "small");
  assert.equal(toSizeEstimate("micro"), "small");
  assert.equal(toSizeEstimate("full sleeve"), "large");
  assert.equal(toSizeEstimate("medium-ish piece"), "medium");
  assert.equal(toSizeEstimate("???"), "unknown");
});

// ── mapVisionTags ───────────────────────────────────────────────────────────
test("mapVisionTags: maps object-form styles, dedups keeping max confidence", () => {
  const tags = mapVisionTags({
    styles: [
      { slug: "blackwork", confidence: 0.7 },
      { name: "Black Work", confidence: 0.9 }, // dup via alias, higher conf wins
      { slug: "steampunk", confidence: 0.99 }, // unknown -> dropped
      { slug: "dotwork", confidence: 0.4 },
    ],
    placement: ["Left Forearm", "bicep"],
    color_type: "black and grey",
    size_estimate: "sleeve",
    subject_matter: ["Koi Fish", "waves"],
    description: "A koi swimming up a sleeve.",
  });
  assert.deepEqual(
    tags.styles.map((s) => s.slug),
    ["blackwork", "dotwork"],
  );
  assert.equal(tags.styles[0]!.confidence, 0.9);
  assert.deepEqual(tags.placement.sort(), ["forearm", "upper-arm"]);
  assert.equal(tags.color_type, "black_grey");
  assert.equal(tags.size_estimate, "large");
  assert.deepEqual(tags.subject_matter, ["koi fish", "waves"]);
});

test("mapVisionTags: accepts bare-string styles and a comma string placement", () => {
  const tags = mapVisionTags({
    styles: ["Realism", "portrait"],
    placement: "chest, sternum",
    subject_matter: "lion",
  });
  assert.deepEqual(tags.styles.map((s) => s.slug).sort(), ["portrait", "realism"]);
  assert.deepEqual(tags.placement, ["chest"]); // both map to chest -> dedup
  assert.deepEqual(tags.subject_matter, ["lion"]);
});

test("mapVisionTags: tolerates 0..100 confidence scale", () => {
  const tags = mapVisionTags({ styles: [{ slug: "anime", confidence: 85 }] });
  assert.equal(tags.styles[0]!.confidence, 0.85);
});

test("mapVisionTags: empty / junk input yields safe empty tags", () => {
  const tags = mapVisionTags({});
  assert.deepEqual(tags.styles, []);
  assert.deepEqual(tags.placement, []);
  assert.equal(tags.color_type, "unknown");
  assert.equal(tags.size_estimate, "unknown");
});

// ── buildImageVector ────────────────────────────────────────────────────────
function tagsOf(over: Partial<ImageTags>): ImageTags {
  return {
    styles: [],
    placement: [],
    color_type: "unknown",
    size_estimate: "unknown",
    subject_matter: [],
    description: "",
    ...over,
  };
}

test("buildImageVector: correct dimension and L2-normalized", () => {
  const v = buildImageVector(
    tagsOf({ styles: [{ slug: "realism", confidence: 0.8 }], color_type: "color" }),
  );
  assert.equal(v.length, VECTOR_DIM);
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, `expected unit norm, got ${norm}`);
});

test("buildImageVector: deterministic — same tags produce identical vectors", () => {
  const t = tagsOf({
    styles: [{ slug: "japanese-irezumi", confidence: 0.9 }],
    placement: ["sleeve"],
    subject_matter: ["koi", "waves"],
    description: "koi swimming upstream",
  });
  assert.deepEqual(buildImageVector(t), buildImageVector(t));
});

test("buildImageVector: all-zero tags yield a zero vector (no NaN)", () => {
  const v = buildImageVector(tagsOf({}));
  assert.equal(v.length, VECTOR_DIM);
  assert.ok(v.every((x) => x === 0));
});

test("similarity: same style ranks above different style; identical is ~1", () => {
  const realismA = buildImageVector(
    tagsOf({ styles: [{ slug: "realism", confidence: 0.9 }], color_type: "black_grey" }),
  );
  const realismB = buildImageVector(
    tagsOf({ styles: [{ slug: "realism", confidence: 0.8 }], color_type: "black_grey" }),
  );
  const traditional = buildImageVector(
    tagsOf({ styles: [{ slug: "american-traditional", confidence: 0.9 }], color_type: "color" }),
  );
  const same = buildImageVector(
    tagsOf({ styles: [{ slug: "realism", confidence: 0.9 }], color_type: "black_grey" }),
  );

  assert.ok(Math.abs(cosineSimilarity(realismA, same) - 1) < 1e-9);
  assert.ok(
    cosineSimilarity(realismA, realismB) > cosineSimilarity(realismA, traditional),
    "same-style pair should be more similar than cross-style pair",
  );
});

test("similarity: shared subject matter pulls two pieces closer", () => {
  const base = tagsOf({ styles: [{ slug: "fine-line", confidence: 0.8 }] });
  const rose1 = buildImageVector({ ...base, subject_matter: ["rose", "thorns"] });
  const rose2 = buildImageVector({ ...base, subject_matter: ["rose", "leaves"] });
  const skull = buildImageVector({ ...base, subject_matter: ["skull", "snake"] });
  assert.ok(
    cosineSimilarity(rose1, rose2) > cosineSimilarity(rose1, skull),
    "shared 'rose' subject should rank above disjoint subjects",
  );
});

test("toPgVectorLiteral: formats a bracketed comma list", () => {
  assert.equal(toPgVectorLiteral([0, 1, -0.5]), "[0.000000,1.000000,-0.500000]");
});

// ── parseVisionResponse + one-shot ──────────────────────────────────────────
test("parseVisionResponse: extracts JSON from a fenced / chatty response", () => {
  const raw = 'Sure!\n```json\n{ "styles": [{"slug":"dotwork","confidence":0.7}] }\n```';
  const out = parseVisionResponse(raw);
  assert.ok(Array.isArray(out.styles));
});

test("parseVisionResponse: throws when there is no JSON object", () => {
  assert.throws(() => parseVisionResponse("I cannot help with that."));
});

test("tagsFromVisionResponse: end-to-end raw text -> tags + embedding", () => {
  const raw = JSON.stringify({
    styles: [{ slug: "Black & Grey", confidence: 0.8 }, { name: "realism", confidence: 0.6 }],
    placement: ["forearm"],
    color_type: "black and grey",
    size_estimate: "medium",
    subject_matter: ["wolf"],
    description: "A snarling wolf on the forearm.",
  });
  const { tags, embedding } = tagsFromVisionResponse(raw);
  assert.deepEqual(tags.styles.map((s) => s.slug).sort(), ["black-and-grey", "realism"]);
  assert.equal(tags.color_type, "black_grey");
  assert.equal(embedding.length, VECTOR_DIM);
  const norm = Math.sqrt(embedding.reduce((a, x) => a + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});
