/**
 * Pure, platform-neutral math for the shared <StarRating> primitive (web +
 * native). No React / DOM / RN imports, so the half-star rounding and per-star
 * fill fractions are unit-testable under `node --test`:
 *   node --test packages/ui/src/starRating/starMath.test.ts
 *
 * Contract:
 *  - DISPLAY rounds a raw rating (e.g. a 3.7 aggregate) to the nearest half,
 *    then each of the 5 stars gets a fill fraction in {0, 0.5, 1}.
 *  - INPUT maps a tapped/hovered star (1..5) + a half flag to a rating value.
 * The underlying numeric rating stored in the DB is never changed by this file.
 */

export const STAR_COUNT = 5;

/** Clamp any number into the valid 0..5 rating range (NaN → 0). */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > STAR_COUNT) return STAR_COUNT;
  return value;
}

/** Round a rating to the nearest 0.5 (for display), clamped to 0..5. */
export function roundToHalf(value: number): number {
  return clampRating(Math.round(clampRating(value) * 2) / 2);
}

/**
 * Fill fraction for each of the 5 stars given a raw rating. The value is
 * rounded to the nearest half first, so every entry is exactly 0, 0.5, or 1.
 * Star index is 0-based (star 1 == index 0).
 */
export function starFillFractions(value: number): number[] {
  const rounded = roundToHalf(value);
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const frac = rounded - i;
    if (frac <= 0) return 0;
    if (frac >= 1) return 1;
    return frac; // only ever 0.5 after half-rounding
  });
}

/**
 * Rating produced by selecting a star in INPUT mode. `star` is 1-based (1..5);
 * `half` true selects the left/lower half (star - 0.5).
 */
export function ratingFromStar(star: number, half = false): number {
  return clampRating(half ? star - 0.5 : star);
}

/**
 * Rating from a horizontal pointer position across the star row, used for
 * precise (mouse/pen) half-star input on web. `ratio` is 0..1 across the row;
 * `allowHalf` toggles half vs. whole-star granularity. Always returns ≥ 0.5 so
 * a click never yields an empty (0) rating.
 */
export function ratingFromRatio(ratio: number, allowHalf = true): number {
  const raw = clampRating(ratio * STAR_COUNT);
  const stepped = allowHalf ? Math.ceil(raw * 2) / 2 : Math.ceil(raw);
  return clampRating(Math.max(allowHalf ? 0.5 : 1, stepped));
}

/** Step a rating up/down (keyboard). `dir` is +1 / -1; step 0.5 or 1. */
export function stepRating(value: number, dir: number, allowHalf = true): number {
  const step = allowHalf ? 0.5 : 1;
  return clampRating(roundToStep(clampRating(value) + dir * step, step));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}
