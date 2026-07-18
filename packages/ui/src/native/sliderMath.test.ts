// Offline unit tests for the pure slider math. No renderer, no react-native —
// just the ratio + accessibility-percent contract that keeps a fractional
// domain value (e.g. try-on opacity 0.15) from reaching Fabric's integer-typed
// accessibilityValue and throwing "Loss of precision during arithmetic
// conversion: (long long) 0.15".
//
//   node --test packages/ui/src/native/sliderMath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { sliderRatio, a11yPercent } from "./sliderMath.ts";

test("sliderRatio maps value into 0..1, clamped at the ends", () => {
  assert.equal(sliderRatio(0, 0, 100), 0);
  assert.equal(sliderRatio(50, 0, 100), 0.5);
  assert.equal(sliderRatio(100, 0, 100), 1);
  assert.equal(sliderRatio(-20, 0, 100), 0); // below min clamps to 0
  assert.equal(sliderRatio(200, 0, 100), 1); // above max clamps to 1
});

test("sliderRatio is safe when max <= min (degenerate track)", () => {
  assert.equal(sliderRatio(5, 10, 10), 0);
  assert.equal(sliderRatio(5, 10, 0), 0);
});

test("a11yPercent is ALWAYS a whole number (the Fabric-crash guard)", () => {
  // The exact reproduction: try-on opacity slider, min 0.15, default ~0.85.
  const now = a11yPercent(0.85, 0.15, 1);
  assert.equal(Number.isInteger(now), true);
  assert.equal(now, 82); // (0.85-0.15)/(1-0.15) = 0.8235.. -> 82

  // The literal crashing value 0.15 (at min) reports as integer 0, never 0.15.
  const atMin = a11yPercent(0.15, 0.15, 1);
  assert.equal(Number.isInteger(atMin), true);
  assert.equal(atMin, 0);

  // A fractional-step price/scale slider still yields an integer percent.
  for (const v of [0.15, 0.37, 1.23, 2.5, 3.5]) {
    assert.equal(Number.isInteger(a11yPercent(v, 0.15, 3.5)), true);
  }
});

test("a11yPercent covers the full 0..100 integer range", () => {
  assert.equal(a11yPercent(0.15, 0.15, 1), 0);
  assert.equal(a11yPercent(1, 0.15, 1), 100);
});
