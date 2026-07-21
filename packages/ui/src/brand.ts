/**
 * INKD brand geometry — the ink-drop compass.
 *
 * One ink drop whose tip serves as north, with three violet compass points at
 * west / east / south. Traced from the master artwork (the 2084² inkd-logo.png)
 * onto the 48×48 art box every icon shares, so the mark can never drift between
 * web, native, and the generated app icons.
 *
 * The numbers are fitted, not eyeballed: the bulb is a circle of r=8.91 centred
 * at (24, 23.98); the drop's flanks are a cubic whose controls fit the measured
 * edge to an RMS of 0.07 units; the crescent is the difference of two circles
 * fitted to the art (outer r=7.62 at (24.57, 23.62), inner r=12.48 at
 * (29.21, 18.49)) with residuals under 0.7px at full scale.
 */

/**
 * The drop and its crescent as ONE even-odd path: the crescent is a hole, not a
 * white shape, so it shows whatever surface sits behind the mark. That is what
 * lets the same path read correctly in both tones — dark drop on the white icon
 * plate, light drop on the near-black app canvas — with no recolouring.
 *
 * Consumers MUST render this with the even-odd fill rule or the crescent fills in.
 */
export const COMPASS_DROP =
  "M24 2.6 C25.26 15.04 32.91 17.65 32.91 23.98 A8.91 8.91 0 0 1 15.09 23.98 C15.09 17.65 22.74 15.04 24 2.6 Z " +
  "M17.18 21.79 A7.62 7.62 0 0 0 27.13 30.79 A12.48 12.48 0 0 1 17.18 21.79 Z";

/**
 * The three compass points. There is no north point — the drop's tip is north.
 * Each base bows 0.185 units toward its apex, as drawn in the master art.
 */
export const COMPASS_POINTS: readonly string[] = [
  "M2.04 24 L11.93 21 Q11.56 24 11.93 27 Z", // west
  "M45.96 24 L36.07 21 Q36.44 24 36.07 27 Z", // east
  "M24 45.96 L21 36.07 Q24 36.44 27 36.07 Z", // south
];

/** Brand violet (primary[600]) — the compass points, constant in every theme. */
export const COMPASS_VIOLET = "#7C3AED";

/** The drop on a near-black surface (neutral[50]). */
export const DROP_ON_DARK = "#FAFAFA";
/** The drop on a light surface — the icon plate, paper (neutral[950]). */
export const DROP_ON_LIGHT = "#0A0A0B";
/**
 * The whole mark on a solid violet brand plate (brand.onBrand). Violet compass
 * points would vanish there, so on those surfaces the points take this ink too.
 */
export const ON_BRAND_INK = "#FAFAFA";
