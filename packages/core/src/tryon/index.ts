/**
 * Photo-based tattoo "fit check" — shared, platform-neutral helpers.
 *
 * A fit check is a PLACEMENT PREVIEW: you size a design, drop it on a photo,
 * and sit with it. It is NOT a prediction of the finished tattoo and it is NOT
 * augmented reality — no live camera, no AI generation, nothing leaves the
 * device. The honest-framing copy below is the single source of truth for both
 * web and mobile so the disclaimer can never drift between surfaces (the brand
 * honesty rail — the "Ephemeral over-promise" lesson, see docs/SPEC.md §Try-on).
 */

// --- Honesty rails: brand copy (one source of truth) ------------------------

export const TRYON_TITLE = "Fit check";

/** The mono placard stamped onto every export. Keep it blunt. */
export const TRYON_PLACARD_LABEL =
  "INKD FIT CHECK — placement preview, not a prediction";

/** The framing line shown across the surface. */
export const TRYON_TAGLINE =
  "size it, place it, sit with it — your artist makes it real";

/** "It stays on your device" reassurance, per platform. */
export const TRYON_LOCAL_ONLY_WEB =
  "Your photo never leaves this device — the whole fit check runs in your browser.";
export const TRYON_LOCAL_ONLY_MOBILE =
  "Your photo stays on your phone — nothing is uploaded.";

/** The pre-export disclaimer. Must be visible before anyone downloads/shares. */
export const TRYON_DISCLAIMER =
  "A rough placement preview — not a prediction of the finished tattoo, and not live AR. Skin tone, curves, healing and your artist's own linework all change how it really lands.";

// --- Transform model --------------------------------------------------------

export interface TryOnTransform {
  /** Center X as a fraction of the stage width (0–1). */
  x: number;
  /** Center Y as a fraction of the stage height (0–1). */
  y: number;
  /** Uniform scale multiplier relative to the design's base fit size. */
  scale: number;
  /** Rotation in degrees (−180…180). */
  rotation: number;
  /** Layer opacity (0–1). */
  opacity: number;
  /**
   * Total cylindrical wrap angle in degrees — how far around a limb the
   * design curves, NOT a shear. `0` = flat sheet (identity), `TRYON_WRAP_MAX_DEG`
   * (~150°) = wraps most of the way around a cylinder. See
   * `cylindricalWarpStrip` below for the actual per-strip remap math. Slider
   * label: "Wrap (limb curve)".
   */
  wrap: number;
  /** When true, composite multiply + desaturate so ink sits IN the skin. */
  inkBlend: boolean;
}

export const DEFAULT_TRYON_TRANSFORM: TryOnTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 0.85,
  wrap: 0,
  inkBlend: true,
};

/**
 * Believability constants, tuned across light and dark skin photos.
 *
 * Multiply drops the design's white paper to nothing and lets the mid/dark
 * linework "sink" into the skin instead of floating on top. A slight
 * desaturation + contrast pull-back keeps fresh solid black from reading like a
 * sticker — closer to how healed ink diffuses. On very dark skin multiply can
 * swallow the art, so the UI always lets the user turn ink-blend OFF (plain
 * over-compositing with opacity) — that combination covers both extremes.
 */
export const INK_BLEND = {
  compositeOperation: "multiply" as const,
  saturate: 0.72,
  contrast: 0.94,
  opacity: 0.85,
} as const;

/** Max total cylindrical wrap angle (degrees) — see `TryOnTransform.wrap`. */
export const TRYON_WRAP_MAX_DEG = 150;

/**
 * Strip counts used to build the cylindrical warp per platform. Web renders
 * through an offscreen `<canvas>`, so it can afford a fine slice. The RN
 * renderer has no canvas/GPU image-warp primitive available in this app (no
 * react-native-skia dependency), so mobile approximates the same math with a
 * coarser strip count built from plain absolutely-positioned, cropped
 * `<Image>` slices — see apps/mobile/app/try-on.tsx.
 */
export const TRYON_WRAP_STRIPS_WEB = 80;
export const TRYON_WRAP_STRIPS_MOBILE = 14;

export const TRYON_LIMITS = {
  scaleMin: 0.15,
  scaleMax: 3.5,
  wrapMin: 0,
  wrapMax: TRYON_WRAP_MAX_DEG,
  rotationMin: -180,
  rotationMax: 180,
  opacityMin: 0.15,
  opacityMax: 1,
  /** Max working dimension for uploaded images (memory + compositing perf). */
  maxImageDim: 1600,
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Normalize a rotation into the −180…180 range. */
export function normalizeRotation(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

/** Clamp every field of a transform back into its legal range. */
export function clampTransform(t: TryOnTransform): TryOnTransform {
  return {
    x: clamp(t.x, 0, 1),
    y: clamp(t.y, 0, 1),
    scale: clamp(t.scale, TRYON_LIMITS.scaleMin, TRYON_LIMITS.scaleMax),
    rotation: normalizeRotation(t.rotation),
    opacity: clamp(t.opacity, TRYON_LIMITS.opacityMin, TRYON_LIMITS.opacityMax),
    wrap: clamp(t.wrap, TRYON_LIMITS.wrapMin, TRYON_LIMITS.wrapMax),
    inkBlend: t.inkBlend,
  };
}

// --- Cylindrical wrap math ----------------------------------------------------

/**
 * The "Wrap (limb curve)" control simulates a flat design pressed onto a
 * cylinder (the limb) and viewed face-on — NOT a shear. A shear turns a
 * square into a parallelogram, which reads as obviously fake. A real
 * cylindrical wrap slices the design into vertical strips and remaps each
 * strip's horizontal position with a sine projection around the design's
 * local vertical axis:
 *
 *   - Strips near the center of the design stay close to full width — that
 *     part of the "limb" faces the viewer head-on.
 *   - Strips toward the left/right silhouette edges compress horizontally,
 *     because that part of the cylinder's surface is curving away from view
 *     (foreshortening).
 *   - Those same edge strips also darken slightly (grazing light catches
 *     curved skin/ink less directly) and, at the very extreme of a strong
 *     wrap, fade in opacity (ink at a full grazing angle all but disappears).
 *
 * `wrapDeg` is the TOTAL angular arc the design's width is bent around (half
 * on each side of the vertical center line) — this is what "effective
 * cylinder radius vs design width" means: a wider angle for the same design
 * width implies a proportionally smaller-radius cylinder. `wrapDeg <= 0` is
 * the identity mapping (flat sheet, no distortion).
 */

/** How strongly edge strips darken as the surface curves away (0 = no
 *  darkening, 1 = the most-curved strip at max wrap would go fully black).
 *  Kept well under 1 so the effect reads as subtle shading, not silhouette. */
const WRAP_BRIGHTNESS_STRENGTH = 0.38;

/** Extra opacity fade applied only to the outermost sliver of a strong wrap. */
const WRAP_EDGE_OPACITY_STRENGTH = 0.3;

/** Fraction of the half-width (0..1 from center) where the edge-opacity
 *  falloff starts ramping in — only the last ~18% of a strong wrap fades. */
const WRAP_EDGE_OPACITY_START = 0.82;

export interface WarpStrip {
  /** Strip index, 0-based, left to right. */
  index: number;
  /** Source strip bounds, normalized [0,1] across the flat design width. */
  uStart: number;
  uEnd: number;
  /**
   * Destination bounds, normalized [0,1] across the same design-width frame
   * (i.e. `xStart`/`xEnd` live in the same [0,1] span as `uStart`/`uEnd` —
   * only the internal proportions change). At `wrapDeg <= 0` this is the
   * identity: `xStart === uStart`, `xEnd === uEnd`.
   */
  xStart: number;
  xEnd: number;
  /** Destination width, `xEnd - xStart` (convenience). */
  width: number;
  /** Multiplicative brightness for this strip, 1 = full brightness. */
  brightness: number;
  /** Multiplicative opacity for this strip, 1 = fully opaque. */
  opacity: number;
}

/** Forward cylindrical projection of a signed, center-origin coordinate
 *  (`su` in [-1,1]) through a half-wrap angle (radians). Identity as
 *  `halfWrapRad -> 0`. */
function wrapProject(su: number, halfWrapRad: number): number {
  if (halfWrapRad < 1e-6) return su;
  return Math.sin(su * halfWrapRad) / Math.sin(halfWrapRad);
}

function wrapBrightness(su: number, halfWrapRad: number): number {
  if (halfWrapRad < 1e-6) return 1;
  const theta = Math.abs(su) * halfWrapRad;
  const falloff = 1 - Math.cos(theta); // 0 at center, up to 1-cos(halfWrapRad) at the edge
  return 1 - falloff * WRAP_BRIGHTNESS_STRENGTH;
}

/** Max half-wrap angle (radians) — used to scale the edge-opacity effect by
 *  how strong the current wrap is, so a mild wrap barely fades anything and
 *  only a wrap near `TRYON_WRAP_MAX_DEG` reaches the full fade strength. */
const WRAP_MAX_HALF_RAD = (TRYON_WRAP_MAX_DEG * Math.PI) / 360;

function wrapOpacity(su: number, halfWrapRad: number): number {
  if (halfWrapRad < 1e-6) return 1;
  const a = Math.abs(su);
  if (a <= WRAP_EDGE_OPACITY_START) return 1;
  const span = Math.max(1e-6, 1 - WRAP_EDGE_OPACITY_START);
  const t2 = clamp((a - WRAP_EDGE_OPACITY_START) / span, 0, 1);
  const eased = t2 * t2 * (3 - 2 * t2); // smoothstep
  const intensity = clamp(halfWrapRad / WRAP_MAX_HALF_RAD, 0, 1); // 0 at flat, 1 at max wrap
  return 1 - eased * WRAP_EDGE_OPACITY_STRENGTH * intensity;
}

/**
 * Compute one strip's source/destination geometry + shading for a
 * cylindrical wrap. Pure function of `(index, stripCount, wrapDeg)` — safe to
 * unit test directly and cheap enough to memoize per `(stripCount, wrapDeg)`
 * on both platforms (re-slice only when the wrap amount or source changes,
 * not on every scale/rotate/position/opacity tweak).
 */
export function cylindricalWarpStrip(
  index: number,
  stripCount: number,
  wrapDeg: number,
): WarpStrip {
  const n = Math.max(1, Math.round(stripCount));
  const i = clamp(Math.round(index), 0, n - 1);
  const wrap = clamp(wrapDeg, 0, TRYON_WRAP_MAX_DEG);
  const halfWrapRad = (wrap * Math.PI) / 360; // wrapDeg is the TOTAL arc; half on each side of center

  const uStart = i / n;
  const uEnd = (i + 1) / n;
  const suStart = uStart * 2 - 1;
  const suEnd = uEnd * 2 - 1;
  const suMid = (suStart + suEnd) / 2;

  const xStart = (wrapProject(suStart, halfWrapRad) + 1) / 2;
  const xEnd = (wrapProject(suEnd, halfWrapRad) + 1) / 2;

  return {
    index: i,
    uStart,
    uEnd,
    xStart,
    xEnd,
    width: xEnd - xStart,
    brightness: wrapBrightness(suMid, halfWrapRad),
    opacity: wrapOpacity(suMid, halfWrapRad),
  };
}

/**
 * All strips for a given count/wrap, left to right — a convenience wrapper
 * around `cylindricalWarpStrip` for callers building the whole slice set in
 * one pass (both renderers cache this per `(stripCount, wrapDeg, source)`).
 */
export function cylindricalWarpStrips(stripCount: number, wrapDeg: number): WarpStrip[] {
  const n = Math.max(1, Math.round(stripCount));
  const strips: WarpStrip[] = [];
  for (let i = 0; i < n; i++) strips.push(cylindricalWarpStrip(i, n, wrapDeg));
  return strips;
}

// --- Portable image math ----------------------------------------------------

/**
 * Fit `width`×`height` inside a `maxDim` box, preserving aspect ratio. Pure
 * math shared by both platforms' downscalers (web canvas, RN Image resize).
 */
export function fitDimensions(
  width: number,
  height: number,
  maxDim: number = TRYON_LIMITS.maxImageDim,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxDim || longest === 0) {
    return { width, height, scaled: false };
  }
  const ratio = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** CSS/DOM `filter` string for the desaturated ink layer (web + RN Image). */
export function inkFilter(): string {
  return `saturate(${INK_BLEND.saturate}) contrast(${INK_BLEND.contrast})`;
}

/**
 * Deep-link builder for the fit-check entry points (post detail, flash items,
 * tools cards). Passes a design image URL straight through — no API, no DB.
 */
export function tryOnHref(designUrl?: string | null): string {
  if (!designUrl) return "/try-on";
  return `/try-on?design=${encodeURIComponent(designUrl)}`;
}
