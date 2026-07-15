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
  /** Horizontal skew in degrees — fakes limb curvature. */
  skewX: number;
  /** When true, composite multiply + desaturate so ink sits IN the skin. */
  inkBlend: boolean;
}

export const DEFAULT_TRYON_TRANSFORM: TryOnTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 0.85,
  skewX: 0,
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

export const TRYON_LIMITS = {
  scaleMin: 0.15,
  scaleMax: 3.5,
  skewMin: -28,
  skewMax: 28,
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
    skewX: clamp(t.skewX, TRYON_LIMITS.skewMin, TRYON_LIMITS.skewMax),
    inkBlend: t.inkBlend,
  };
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
