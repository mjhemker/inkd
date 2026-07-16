/**
 * INKD body-map — the single, platform-agnostic source of truth for tattoo
 * placement.
 *
 * A placement is a structured triple `{ region, side, view }` plus a derived
 * human label ("Left forearm"). Web (`../web/BodyMap`) and native
 * (`../native/BodyMap`) render the SAME geometry from `FIGURES` below, so the
 * region set, laterality, and labels never drift between platforms. This file
 * has ZERO React / DOM / RN imports — it is pure data + pure functions, which
 * is what makes the region→label mapping and the DB round-trip unit-testable
 * under `node --test`.
 *
 * Laterality convention: sides are the WEARER's own body (anatomical), not the
 * viewer's. On the FRONT view the subject faces you, so a shape on the LEFT of
 * the screen is the subject's RIGHT; on the BACK view it flips. Each shape
 * carries its resolved `side` explicitly so callers never have to mirror.
 */

// ---------------------------------------------------------------------------
// Core value types
// ---------------------------------------------------------------------------
export type PlacementView = "front" | "back";
export type PlacementSide = "left" | "right";

/** The structured placement a client selects, stored across three DB columns. */
export interface PlacementValue {
  region: RegionKey;
  side: PlacementSide | null;
  view: PlacementView;
}

/**
 * Loose column shape for READING from the DB, where the three columns arrive
 * as plain `string | null` (they are text columns).
 */
export interface PlacementColumns {
  placement_region: string | null;
  placement_side: string | null;
  placement_view: string | null;
}

/**
 * Narrow column shape for WRITING — the values are constrained to the domain
 * unions so the booking-request insert payload typechecks against the zod
 * schema without a cast.
 */
export interface PlacementColumnsWrite {
  placement_region: RegionKey | null;
  placement_side: PlacementSide | null;
  placement_view: PlacementView | null;
}

// ---------------------------------------------------------------------------
// Region catalog — keyed by a stable region key, view-independent labels.
// A region may appear in more than one view (e.g. `forearm` is front + back);
// `view` on the PlacementValue disambiguates. Regions whose natural name
// differs between views get distinct keys (shin vs calf, foot vs heel).
// ---------------------------------------------------------------------------
export const REGION_DEFS = {
  head: { label: "Head", lateral: false },
  neck: { label: "Neck", lateral: false },
  chest: { label: "Chest", lateral: false },
  shoulder: { label: "Shoulder", lateral: true },
  upperArm: { label: "Upper arm", lateral: true },
  forearm: { label: "Forearm", lateral: true },
  hand: { label: "Hand", lateral: true },
  ribs: { label: "Ribs", lateral: true },
  stomach: { label: "Stomach", lateral: false },
  hip: { label: "Hip", lateral: false },
  thigh: { label: "Thigh", lateral: true },
  shin: { label: "Shin", lateral: true },
  foot: { label: "Foot", lateral: true },
  upperBack: { label: "Upper back", lateral: false },
  lowerBack: { label: "Lower back", lateral: false },
  fullBack: { label: "Full back", lateral: false },
  glutes: { label: "Glutes", lateral: false },
  calf: { label: "Calf", lateral: true },
  heel: { label: "Heel", lateral: true },
} as const;

export type RegionKey = keyof typeof REGION_DEFS;

export function isRegionKey(v: string): v is RegionKey {
  return Object.prototype.hasOwnProperty.call(REGION_DEFS, v);
}

// ---------------------------------------------------------------------------
// Drawable primitives — a tiny shape union that both <svg> (web) and
// react-native-svg (native) can render with Circle / Rect(rx) / Ellipse.
// ---------------------------------------------------------------------------
export type Shape =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rrect"; x: number; y: number; w: number; h: number; rx: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

/** One tappable region on a figure. */
export interface RegionShape {
  region: RegionKey;
  side: PlacementSide | null;
  shape: Shape;
  /** Centroid, used to place selection ticks / labels. */
  center: { x: number; y: number };
}

export interface Figure {
  view: PlacementView;
  /** SVG user-space viewBox both renderers share. */
  viewBox: { w: number; h: number };
  regions: RegionShape[];
}

// Geometry is authored once against a 200 x 390 canvas. Left-of-canvas shapes
// resolve to the wearer's RIGHT on the front and LEFT on the back.
const VIEWBOX = { w: 200, h: 390 };

function rr(
  region: RegionKey,
  side: PlacementSide | null,
  x: number,
  y: number,
  w: number,
  h: number,
  rx = Math.min(w, h) / 2,
): RegionShape {
  return {
    region,
    side,
    shape: { kind: "rrect", x, y, w, h, rx },
    center: { x: x + w / 2, y: y + h / 2 },
  };
}
function ci(
  region: RegionKey,
  side: PlacementSide | null,
  cx: number,
  cy: number,
  r: number,
): RegionShape {
  return { region, side, shape: { kind: "circle", cx, cy, r }, center: { x: cx, y: cy } };
}

// --- Front figure -----------------------------------------------------------
// Screen-left column (x < 100) = wearer's RIGHT; screen-right = wearer's LEFT.
const FRONT: Figure = {
  view: "front",
  viewBox: VIEWBOX,
  regions: [
    ci("head", null, 100, 34, 22),
    rr("neck", null, 90, 54, 20, 16, 6),
    ci("shoulder", "right", 62, 82, 16),
    ci("shoulder", "left", 138, 82, 16),
    rr("chest", null, 68, 70, 64, 42, 14),
    rr("ribs", "right", 66, 112, 20, 34, 8),
    rr("ribs", "left", 114, 112, 20, 34, 8),
    rr("stomach", null, 86, 112, 28, 48, 9),
    rr("hip", null, 70, 160, 60, 30, 13),
    rr("upperArm", "right", 42, 92, 22, 58, 11),
    rr("upperArm", "left", 136, 92, 22, 58, 11),
    rr("forearm", "right", 36, 152, 20, 56, 10),
    rr("forearm", "left", 144, 152, 20, 56, 10),
    rr("hand", "right", 32, 210, 20, 26, 9),
    rr("hand", "left", 148, 210, 20, 26, 9),
    rr("thigh", "right", 74, 192, 24, 76, 12),
    rr("thigh", "left", 102, 192, 24, 76, 12),
    rr("shin", "right", 76, 270, 20, 78, 10),
    rr("shin", "left", 104, 270, 20, 78, 10),
    rr("foot", "right", 72, 350, 22, 18, 7),
    rr("foot", "left", 106, 350, 22, 18, 7),
  ],
};

// --- Back figure ------------------------------------------------------------
// Screen-left column = wearer's LEFT; screen-right = wearer's RIGHT.
const BACK: Figure = {
  view: "back",
  viewBox: VIEWBOX,
  regions: [
    ci("head", null, 100, 34, 22),
    rr("neck", null, 90, 54, 20, 16, 6),
    ci("shoulder", "left", 62, 82, 16),
    ci("shoulder", "right", 138, 82, 16),
    rr("upperBack", null, 68, 70, 64, 48, 14),
    rr("lowerBack", null, 74, 118, 52, 44, 12),
    rr("glutes", null, 72, 162, 56, 30, 13),
    rr("upperArm", "left", 42, 92, 22, 58, 11),
    rr("upperArm", "right", 136, 92, 22, 58, 11),
    rr("forearm", "left", 36, 152, 20, 56, 10),
    rr("forearm", "right", 144, 152, 20, 56, 10),
    rr("hand", "left", 32, 210, 20, 26, 9),
    rr("hand", "right", 148, 210, 20, 26, 9),
    rr("thigh", "left", 74, 192, 24, 76, 12),
    rr("thigh", "right", 102, 192, 24, 76, 12),
    rr("calf", "left", 76, 270, 20, 78, 10),
    rr("calf", "right", 104, 270, 20, 78, 10),
    rr("heel", "left", 72, 350, 22, 18, 7),
    rr("heel", "right", 106, 350, 22, 18, 7),
  ],
};

export const FIGURES: Record<PlacementView, Figure> = { front: FRONT, back: BACK };

// ---------------------------------------------------------------------------
// Label mapping
// ---------------------------------------------------------------------------
/**
 * Human label for a placement, e.g. `{ region:"forearm", side:"left" }` →
 * "Left forearm", `{ region:"chest" }` → "Chest". Side (when the region is
 * lateral) is prefixed; the base label is lowercased after the side so
 * multi-word bases read naturally ("Left upper arm").
 */
export function placementLabel(
  value: Pick<PlacementValue, "region" | "side">,
  opts: { withView?: PlacementView } = {},
): string {
  const def = REGION_DEFS[value.region];
  if (!def) return "Unknown";
  let label: string;
  if (def.lateral && value.side) {
    const sideWord = value.side === "left" ? "Left" : "Right";
    label = `${sideWord} ${def.label.toLowerCase()}`;
  } else {
    label = def.label;
  }
  if (opts.withView === "back") label = `${label} (back)`;
  return label;
}

// ---------------------------------------------------------------------------
// Structured-value ⇄ DB columns round-trip
// ---------------------------------------------------------------------------
export function serializePlacement(value: PlacementValue | null): PlacementColumnsWrite {
  if (!value) {
    return { placement_region: null, placement_side: null, placement_view: null };
  }
  return {
    placement_region: value.region,
    placement_side: value.side,
    placement_view: value.view,
  };
}

/** Rebuild a PlacementValue from stored columns; returns null when absent or
 * malformed (defensive — the columns are plain text at the DB layer). */
export function parsePlacement(cols: Partial<PlacementColumns> | null | undefined): PlacementValue | null {
  if (!cols) return null;
  const { placement_region, placement_side, placement_view } = cols;
  if (!placement_region || !isRegionKey(placement_region)) return null;
  const view: PlacementView = placement_view === "back" ? "back" : "front";
  const side: PlacementSide | null =
    placement_side === "left" || placement_side === "right" ? placement_side : null;
  const def = REGION_DEFS[placement_region];
  // A lateral region must carry a side; a non-lateral one must not.
  const resolvedSide = def.lateral ? side : null;
  return { region: placement_region, side: resolvedSide, view };
}

/** Convenience: the label straight from stored columns (null when unset). */
export function placementLabelFromColumns(
  cols: Partial<PlacementColumns> | null | undefined,
): string | null {
  const v = parsePlacement(cols);
  return v ? placementLabel(v) : null;
}

// ---------------------------------------------------------------------------
// <select> fallback — accessible / tap-precision alternative to the map
// ---------------------------------------------------------------------------
export interface PlacementOption {
  value: string; // encoded "region" or "region:side"
  label: string;
}

/** Stable encode/decode so the <select> value maps 1:1 to a PlacementValue. */
export function encodeOption(v: Pick<PlacementValue, "region" | "side">): string {
  return v.side ? `${v.region}:${v.side}` : v.region;
}
export function decodeOption(value: string, view: PlacementView): PlacementValue | null {
  const [region, side] = value.split(":");
  if (!region || !isRegionKey(region)) return null;
  const def = REGION_DEFS[region];
  const resolvedSide: PlacementSide | null =
    def.lateral && (side === "left" || side === "right") ? side : null;
  return { region, side: resolvedSide, view };
}

// Presentation order for the fallback list (top-to-bottom anatomy).
const FRONT_ORDER: RegionKey[] = [
  "head", "neck", "shoulder", "chest", "ribs", "stomach", "hip",
  "upperArm", "forearm", "hand", "thigh", "shin", "foot",
];
const BACK_ORDER: RegionKey[] = [
  "head", "neck", "shoulder", "upperBack", "lowerBack", "fullBack", "glutes",
  "upperArm", "forearm", "hand", "thigh", "calf", "heel",
];

/**
 * Options for the plain <select> fallback for a view. Lateral regions expand
 * to Left / Right. `fullBack` is catalog-only (no map shape) but is offered
 * here so large back pieces remain selectable.
 */
export function placementSelectOptions(view: PlacementView): PlacementOption[] {
  const order = view === "front" ? FRONT_ORDER : BACK_ORDER;
  const out: PlacementOption[] = [];
  for (const region of order) {
    const def = REGION_DEFS[region];
    if (def.lateral) {
      for (const side of ["left", "right"] as const) {
        out.push({ value: encodeOption({ region, side }), label: placementLabel({ region, side }) });
      }
    } else {
      out.push({ value: encodeOption({ region, side: null }), label: def.label });
    }
  }
  return out;
}

/** True when two placements refer to the same region+side+view. */
export function samePlacement(a: PlacementValue | null, b: PlacementValue | null): boolean {
  if (!a || !b) return a === b;
  return a.region === b.region && a.side === b.side && a.view === b.view;
}
