// Unit tests for the cylindrical "wrap (limb curve)" strip-remap math. Runs
// under Node's built-in runner with type-stripping (Node >= 22.6):
//   node --test packages/core/src/tryon/index.test.ts
//
// These pin the core promise of the try-on fix: `wrap <= 0` must be an exact
// identity (flat sheet, no distortion), a positive wrap must compress strips
// toward the design's left/right edges while the center strip stays widest,
// the strip set must always exactly tile [0,1] (no gaps/overlaps at the
// destination), and the per-strip brightness/opacity shading must be subtle,
// monotonic toward the edges, and never invert.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cylindricalWarpStrip,
  cylindricalWarpStrips,
  TRYON_WRAP_MAX_DEG,
  TRYON_WRAP_STRIPS_WEB,
  TRYON_WRAP_STRIPS_MOBILE,
} from "./index.ts";

function approxEqual(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);
}

test("cylindricalWarpStrip: wrap=0 is an exact identity mapping", () => {
  for (const n of [1, 8, 64]) {
    for (let i = 0; i < n; i++) {
      const strip = cylindricalWarpStrip(i, n, 0);
      approxEqual(strip.xStart, strip.uStart);
      approxEqual(strip.xEnd, strip.uEnd);
      approxEqual(strip.width, strip.uEnd - strip.uStart);
      assert.equal(strip.brightness, 1);
      assert.equal(strip.opacity, 1);
    }
  }
});

test("cylindricalWarpStrip: negative wrap clamps to the flat identity", () => {
  const strip = cylindricalWarpStrip(3, 10, -40);
  approxEqual(strip.xStart, strip.uStart);
  approxEqual(strip.xEnd, strip.uEnd);
  assert.equal(strip.brightness, 1);
  assert.equal(strip.opacity, 1);
});

test("cylindricalWarpStrip: a positive wrap compresses edge strips relative to the center strip", () => {
  const n = 8;
  const wrap = 120;
  const strips = cylindricalWarpStrips(n, wrap);
  const centerWidths = strips.slice(3, 5).map((s) => s.width); // the two middle strips straddle su=0
  const edgeWidths = [strips[0]!.width, strips[n - 1]!.width];

  for (const w of centerWidths) {
    for (const e of edgeWidths) {
      assert.ok(w > e, `center strip width ${w} should exceed edge strip width ${e}`);
    }
  }
});

test("cylindricalWarpStrip: strips exactly tile [0,1] with no gaps or overlaps at any wrap", () => {
  for (const wrap of [0, 1, 45, 90, 150, 500 /* clamps to max */]) {
    const strips = cylindricalWarpStrips(16, wrap);
    approxEqual(strips[0]!.xStart, 0, 1e-6);
    approxEqual(strips[strips.length - 1]!.xEnd, 1, 1e-6);
    for (let i = 1; i < strips.length; i++) {
      approxEqual(strips[i]!.xStart, strips[i - 1]!.xEnd, 1e-6);
    }
  }
});

test("cylindricalWarpStrip: wrap clamps at TRYON_WRAP_MAX_DEG — no runaway distortion past the max", () => {
  const atMax = cylindricalWarpStrip(0, 10, TRYON_WRAP_MAX_DEG);
  const beyondMax = cylindricalWarpStrip(0, 10, TRYON_WRAP_MAX_DEG * 4);
  approxEqual(atMax.xStart, beyondMax.xStart);
  approxEqual(atMax.xEnd, beyondMax.xEnd);
  approxEqual(atMax.brightness, beyondMax.brightness);
});

test("cylindricalWarpStrip: brightness is 1 at the center strip and strictly decreases toward an edge", () => {
  const n = 32;
  const wrap = 140;
  const strips = cylindricalWarpStrips(n, wrap);
  const mid = strips[n / 2]!; // straddles su=0
  assert.ok(mid.brightness > 0.99, `center brightness ${mid.brightness} should be ~1`);

  // Walk from center to the right edge — brightness must never increase.
  let prev = mid.brightness;
  for (let i = n / 2 + 1; i < n; i++) {
    const b = strips[i]!.brightness;
    assert.ok(b <= prev + 1e-9, `brightness should be non-increasing toward the edge (${b} > ${prev})`);
    prev = b;
  }
  assert.ok(strips[n - 1]!.brightness < 1, "edge strip should be darkened relative to the flat case");
});

test("cylindricalWarpStrip: brightness falloff is subtle — never crushes an edge strip to black", () => {
  const strips = cylindricalWarpStrips(20, TRYON_WRAP_MAX_DEG);
  for (const s of strips) {
    assert.ok(s.brightness > 0.4, `brightness ${s.brightness} at strip ${s.index} should stay well above 0`);
  }
});

test("cylindricalWarpStrip: opacity only fades the outermost sliver of a strong wrap", () => {
  const n = 40;
  const strips = cylindricalWarpStrips(n, TRYON_WRAP_MAX_DEG);
  const interiorCount = strips.filter((s) => s.opacity >= 0.999).length;
  // Most strips should be fully opaque; only a small band near each edge fades.
  assert.ok(interiorCount > n * 0.6, `expected most strips at full opacity, got ${interiorCount}/${n}`);
  assert.ok(strips[0]!.opacity < 1, "outermost strip should fade at max wrap");
  assert.ok(strips[n - 1]!.opacity < 1, "outermost strip should fade at max wrap");
  for (const s of strips) {
    assert.ok(s.opacity > 0.5, `opacity ${s.opacity} should never collapse the design to invisible`);
  }
});

test("cylindricalWarpStrip: symmetric around the center for a symmetric strip layout", () => {
  const n = 10; // even, so strip i and strip (n-1-i) are mirror images
  const wrap = 100;
  for (let i = 0; i < n / 2; i++) {
    const left = cylindricalWarpStrip(i, n, wrap);
    const right = cylindricalWarpStrip(n - 1 - i, n, wrap);
    approxEqual(left.width, right.width, 1e-9);
    approxEqual(left.brightness, right.brightness, 1e-9);
    approxEqual(left.opacity, right.opacity, 1e-9);
    // Mirrored around x=0.5
    approxEqual(left.xStart, 1 - right.xEnd, 1e-9);
    approxEqual(left.xEnd, 1 - right.xStart, 1e-9);
  }
});

test("cylindricalWarpStrip: index/stripCount are clamped to safe bounds", () => {
  const strip = cylindricalWarpStrip(999, 10, 60);
  assert.equal(strip.index, 9); // clamps to last valid index
  const single = cylindricalWarpStrip(0, 0, 60); // stripCount rounds up to 1
  assert.equal(single.uStart, 0);
  assert.equal(single.uEnd, 1);
});

test("cylindricalWarpStrips: platform strip counts stay 64+/coarser as specced", () => {
  assert.ok(TRYON_WRAP_STRIPS_WEB >= 64, "web should slice at 64+ strips");
  assert.ok(TRYON_WRAP_STRIPS_MOBILE < TRYON_WRAP_STRIPS_WEB, "mobile is the coarser fallback");
  assert.equal(cylindricalWarpStrips(TRYON_WRAP_STRIPS_WEB, 90).length, TRYON_WRAP_STRIPS_WEB);
  assert.equal(cylindricalWarpStrips(TRYON_WRAP_STRIPS_MOBILE, 90).length, TRYON_WRAP_STRIPS_MOBILE);
});
