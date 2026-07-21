// Offline unit tests for the pure star-rating math. Runs under Node's built-in
// runner with type-stripping (Node >= 22.6):
//   node --test packages/ui/src/starRating/starMath.test.ts
//
// Covers the two contracts the <StarRating> UI depends on: half-rounding for
// DISPLAY (aggregate 3.7 -> 3.5 -> per-star fills) and star->value for INPUT.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STAR_COUNT,
  clampRating,
  roundToHalf,
  starFillFractions,
  ratingFromStar,
  ratingFromRatio,
  stepRating,
} from "./starMath.ts";

// --- clampRating ------------------------------------------------------------
test("clampRating pins to 0..5 and treats NaN/Infinity as 0", () => {
  assert.equal(clampRating(-2), 0);
  assert.equal(clampRating(7), 5);
  assert.equal(clampRating(3.2), 3.2);
  assert.equal(clampRating(Number.NaN), 0);
  assert.equal(clampRating(Infinity), 0); // non-finite -> 0 (defensive)
  assert.equal(clampRating(-Infinity), 0);
});

// --- roundToHalf ------------------------------------------------------------
test("roundToHalf snaps to nearest 0.5", () => {
  assert.equal(roundToHalf(3.7), 3.5);
  assert.equal(roundToHalf(3.74), 3.5);
  assert.equal(roundToHalf(3.75), 4); // .75 rounds up to whole
  assert.equal(roundToHalf(4.2), 4);
  assert.equal(roundToHalf(4.25), 4.5);
  assert.equal(roundToHalf(0.24), 0);
  assert.equal(roundToHalf(0.25), 0.5);
  assert.equal(roundToHalf(5), 5);
  assert.equal(roundToHalf(6), 5);
});

// --- starFillFractions ------------------------------------------------------
test("starFillFractions returns 5 entries, each 0 / 0.5 / 1", () => {
  const f = starFillFractions(3.5);
  assert.equal(f.length, STAR_COUNT);
  assert.deepEqual(f, [1, 1, 1, 0.5, 0]);
  f.forEach((x) => assert.ok(x === 0 || x === 0.5 || x === 1, `bad fraction ${x}`));
});

test("starFillFractions rounds a raw aggregate before filling", () => {
  // 3.7 -> display 3.5
  assert.deepEqual(starFillFractions(3.7), [1, 1, 1, 0.5, 0]);
  // 4.8 -> 5.0 (all full)
  assert.deepEqual(starFillFractions(4.8), [1, 1, 1, 1, 1]);
  // 0 -> all empty
  assert.deepEqual(starFillFractions(0), [0, 0, 0, 0, 0]);
  // 2.25 -> 2.5
  assert.deepEqual(starFillFractions(2.25), [1, 1, 0.5, 0, 0]);
  // out of range clamps
  assert.deepEqual(starFillFractions(9), [1, 1, 1, 1, 1]);
});

// --- ratingFromStar (input) -------------------------------------------------
test("ratingFromStar maps star + half flag to a value", () => {
  assert.equal(ratingFromStar(4), 4);
  assert.equal(ratingFromStar(4, true), 3.5);
  assert.equal(ratingFromStar(1, true), 0.5);
  assert.equal(ratingFromStar(5), 5);
});

// --- ratingFromRatio (precise pointer input) --------------------------------
test("ratingFromRatio yields half increments across the row", () => {
  assert.equal(ratingFromRatio(0.0, true), 0.5); // never returns 0 on click
  assert.equal(ratingFromRatio(0.05, true), 0.5);
  assert.equal(ratingFromRatio(0.11, true), 1); // 0.55 -> ceil half -> 1? 0.55*... check below
  assert.equal(ratingFromRatio(0.7, true), 3.5);
  assert.equal(ratingFromRatio(1.0, true), 5);
});

test("ratingFromRatio with allowHalf=false snaps to whole stars", () => {
  assert.equal(ratingFromRatio(0.0, false), 1);
  assert.equal(ratingFromRatio(0.41, false), 3); // 2.05 -> ceil 3
  assert.equal(ratingFromRatio(0.6, false), 3);
  assert.equal(ratingFromRatio(1.0, false), 5);
});

// --- stepRating (keyboard) --------------------------------------------------
test("stepRating moves by half (or whole) and clamps at the ends", () => {
  assert.equal(stepRating(3, 1, true), 3.5);
  assert.equal(stepRating(3, -1, true), 2.5);
  assert.equal(stepRating(5, 1, true), 5);
  assert.equal(stepRating(0, -1, true), 0);
  assert.equal(stepRating(4.5, 1, true), 5);
  assert.equal(stepRating(3, 1, false), 4);
  assert.equal(stepRating(2, -1, false), 1);
});
