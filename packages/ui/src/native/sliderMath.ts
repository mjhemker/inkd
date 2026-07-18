/**
 * Pure slider math shared by Slider + RangeSlider + ProgressBar. Kept RN-free
 * so it is unit-testable under `node --test`.
 *
 * WHY THIS EXISTS (Fabric crash fix): React Native's Fabric renderer types the
 * `accessibilityValue` fields (`min` / `max` / `now`) as integers in the C++
 * component descriptor. Passing a fractional number (e.g. a try-on opacity of
 * 0.15) straight into `accessibilityValue={{ now: value }}` makes createNode
 * throw:
 *
 *   Exception in HostFunction: Loss of precision during arithmetic
 *   conversion: (long long) 0.15
 *
 * The fix: never hand Fabric a fractional accessibility number. We report a
 * whole-number 0–100 percentage instead (min:0, max:100, now:a11yPercent(...)),
 * which is both integer-safe AND a nicer screen-reader read-out ("42 percent")
 * than a raw domain value like 0.15.
 *
 *   node --test packages/ui/src/native/sliderMath.test.ts
 */

/** Normalised 0..1 position of `value` within `[min, max]` (clamped). */
export function sliderRatio(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const clamped = Math.min(Math.max(value, min), max);
  return (clamped - min) / (max - min);
}

/**
 * Integer 0–100 position for `accessibilityValue.now` (paired with min:0,
 * max:100). Always a whole number, so it never trips Fabric's integer
 * conversion on fractional-domain sliders (opacity, scale, price fractions…).
 */
export function a11yPercent(value: number, min: number, max: number): number {
  return Math.round(sliderRatio(value, min, max) * 100);
}
