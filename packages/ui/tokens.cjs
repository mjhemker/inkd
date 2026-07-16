/**
 * INKD design tokens — the single source of truth for color, spacing, radii and
 * type scale across web (Tailwind v4) and mobile (NativeWind v4).
 *
 * Authored as CommonJS so the Tailwind preset (plain JS, loaded by the Tailwind
 * engine at build time) can `require()` it directly, while `tokens.d.ts` gives
 * TypeScript consumers full types.
 *
 * Brand direction (2026-07 restyle — "Placard discipline + Wall warmth"):
 * near-black canvas + SOLID violet-purple primary plates (no glow), with a warm
 * "Ember" accent used sparingly for flash/price warmth. Hard placard edges over
 * rounded pills; solid surfaces over low-opacity tints. Dark-only for the pilot;
 * a light "paper" surface set is reserved ONLY for printable/exported legal
 * records (waivers). See boxShadow / radii / semantic notes below.
 */

// --- Violet / purple primary ramp (brand accent, #7C3AED family) -------------
// Used SOLID: filled violet plates carry emphasis where the old glow used to.
const primary = {
  50: "#F5F3FF",
  100: "#EDE9FE",
  200: "#DDD6FE",
  300: "#C4B5FD",
  400: "#A78BFA",
  500: "#8B5CF6",
  600: "#7C3AED", // brand primary
  700: "#6D28D9",
  800: "#5B21B6",
  900: "#4C1D95",
  950: "#2E1065",
};

// --- Ember warm accent ramp (#E8A15C family) ---------------------------------
// The "Wall warmth" note: a stamped, hand-inked warmth. Reserved for flash
// drops, "stamped" price marks, and small moments of heat — NEVER a second CTA
// and never competing with violet's primary/CTA role. Ember reads as a warm
// pigment on a dark wall; text on solid ember is dark ink (see brand.onEmber).
const ember = {
  300: "#F3C89B",
  400: "#EDB073",
  500: "#E8A15C", // ember base — the stamp color
  600: "#D3813F",
  700: "#A9612B",
};

// --- Paper ramp (PRINT ONLY) -------------------------------------------------
// Warm off-white surface for exported/printable legal records (signed waivers).
// The live app never renders on paper; this set exists so a print stylesheet /
// print-preview block can flip a single document to an archival, ink-on-paper
// look. Violet stays the accent so the brand carries onto the printed page.
const paper = {
  base: "#F6F2E9", // sheet
  raised: "#FFFFFF", // inset panels on the sheet
  ink: "#1C1917", // body ink
  muted: "#6B6257", // secondary ink
  border: "#D8D0BF", // hairline rules
  accent: "#6D28D9", // violet stamp/heading accent (primary[700])
};

// --- Neutral / near-black ramp (#0A0A0B base) --------------------------------
const neutral = {
  50: "#FAFAFA",
  100: "#E4E4E7",
  200: "#D4D4D8",
  300: "#A1A1AA",
  400: "#71717A",
  500: "#52525B",
  600: "#3F3F46",
  700: "#27272A",
  800: "#1A1A1D",
  900: "#111113",
  950: "#0A0A0B", // brand base canvas
};

// --- Status ramps ------------------------------------------------------------
const success = {
  50: "#F0FDF4",
  500: "#22C55E",
  600: "#16A34A",
  700: "#15803D",
};
const warning = {
  50: "#FFFBEB",
  500: "#F59E0B",
  600: "#D97706",
  700: "#B45309",
};
const danger = {
  50: "#FEF2F2",
  500: "#EF4444",
  600: "#DC2626",
  700: "#B91C1C",
};
const info = {
  50: "#EFF6FF",
  500: "#3B82F6",
  600: "#2563EB",
  700: "#1D4ED8",
};

/**
 * Semantic tokens — reference the ramps above. These are what product code and
 * component libraries should consume so the palette can shift without touching
 * feature code.
 *
 * THEME LAYER (2026-07): there are now TWO semantic palettes — `themes.dark`
 * (the default near-black gallery) and `themes.light` (a warm paper-walled
 * gallery). On web/mobile these are emitted as CSS custom properties
 * (see each app's globals.css) and the Tailwind preset reads the vars, so a
 * single `[data-theme="light"]` / `.dark` flip re-skins everything. JS code
 * that needs a concrete color per theme (e.g. the mobile tab bar, native icon
 * glyph colors) should read `themes[scheme]` rather than `semantic` directly.
 *
 * `semantic` is kept as an alias of `themes.dark` so existing imports keep the
 * dark values they always had. DEFAULT REMAINS DARK.
 *
 * Light-palette rationale: lean on the print-only `paper` ramp as the light
 * SURFACE family (warm #F6F2E9 wall, white/near-white placard cards), near-black
 * warm ink for text, the SAME violet-600 primary + ember accent so the brand
 * carries across, and slightly heavier warm placard borders to keep the
 * print-catalog feel. Violet/ember text roles darken (400→700 range) to hold
 * WCAG AA on the light wall; artwork matting stays dark in the feature code
 * (literal scrims), so tattoo photos still pop — a gallery with white walls,
 * not an inverted app. Every key pair verified ≥ AA.
 */
const darkSemantic = {
  surface: {
    base: neutral[950], // app canvas
    raised: neutral[900], // cards, sheets — solid raised ink
    overlay: neutral[800], // popovers, menus
    inverse: neutral[50],
    // SOLID accent plates — replace old low-opacity brand tints (bg-brand/15).
    plate: primary[600], // solid violet plate (emphasis block, active fill)
    plateActive: primary[700], // pressed / stronger violet plate
    plateInk: primary[950], // deep violet plate on dark (subtle, still solid)
    ember: ember[500], // solid ember stamp plate (flash / price marks)
  },
  text: {
    primary: neutral[50],
    secondary: neutral[300],
    muted: neutral[400],
    inverse: neutral[950],
    accent: primary[400],
    ember: ember[500], // warm accent text (labels only, never CTAs)
  },
  border: {
    subtle: neutral[800],
    default: neutral[700],
    strong: neutral[600],
    accent: primary[600],
    ember: ember[600],
  },
  brand: {
    primary: primary[600],
    primaryHover: primary[500], // dark: hover lightens
    primaryActive: primary[700],
    onPrimary: neutral[50],
    onEmber: neutral[950], // dark ink on a solid ember plate
  },
  status: {
    success: success[500],
    warning: warning[500],
    danger: danger[500],
    info: info[500],
  },
  // PRINT-ONLY paper semantics (see `paper` ramp). Not used on-screen.
  paper: {
    base: paper.base,
    raised: paper.raised,
    ink: paper.ink,
    muted: paper.muted,
    border: paper.border,
    accent: paper.accent,
  },
};

// Light theme — warm paper-walled gallery. Surfaces come from the `paper`
// family; violet-600 + ember stay the accents; text/accent roles darken for AA.
const lightSemantic = {
  surface: {
    base: "#F6F2E9", // paper wall (paper.base)
    raised: "#FCFAF4", // warm-white placard card, lifted off the wall
    overlay: "#FFFFFF", // crisp white menus / popovers (top layer)
    inverse: "#1C1917", // near-black inverse surface
    plate: primary[600], // SAME solid violet plate
    plateActive: primary[700], // pressed violet plate
    plateInk: primary[100], // pale violet active-nav fill (#EDE9FE)
    ember: ember[500], // SAME ember stamp plate
  },
  text: {
    primary: "#1C1917", // warm near-black ink (paper.ink)
    secondary: "#514B44", // warm slate
    muted: "#6B6257", // paper.muted
    inverse: "#FFFFFF",
    accent: primary[700], // darker violet for AA on the light wall (#6D28D9)
    ember: "#8A4F20", // darkened ember for AA text on paper
  },
  border: {
    subtle: "#E6DFD0",
    default: "#D2C8B4", // heavier warm placard hairline (print-catalog feel)
    strong: "#B8AC92",
    accent: primary[600],
    ember: "#C77F3E",
  },
  brand: {
    primary: primary[600], // SAME violet-600 primary
    primaryHover: primary[700], // light: hover darkens (#6D28D9)
    primaryActive: primary[800], // (#5B21B6)
    onPrimary: "#FFFFFF",
    onEmber: "#1C1917", // dark ink on the ember plate
  },
  status: {
    success: success[700], // darkened for legibility on paper (#15803D)
    warning: warning[700], // (#B45309)
    danger: danger[600], // (#DC2626)
    info: info[600], // (#2563EB)
  },
  paper: darkSemantic.paper, // print paper set is theme-independent
};

/** The two on-screen themes. DEFAULT (and `semantic`) is dark. */
const themes = { dark: darkSemantic, light: lightSemantic };

// Back-compat: existing `tokens.colors.semantic` consumers keep dark values.
const semantic = darkSemantic;

// --- Spacing (4px base grid) -------------------------------------------------
const spacing = {
  0: "0px",
  px: "1px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  10: "40px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  32: "128px",
};

// --- Radii (placard discipline) ----------------------------------------------
// Shifted hard toward printed-catalog edges. Cards read as museum placards
// (2–4px, near-square); controls stay small; only chips earn a full pill.
// The utility names are unchanged so existing screens keep compiling — their
// resolved values just got sharper.
const radii = {
  none: "0px",
  sm: "2px", // placard hard edge — cards, stamps, badges
  md: "3px", // controls, inputs
  lg: "4px", // buttons, larger cards
  xl: "6px", // grouped panels
  "2xl": "10px", // modals / sheets (restrained, still not soft)
  "3xl": "14px",
  full: "9999px", // pills — chips only, where earned
};

// --- Type scale --------------------------------------------------------------
const fontSize = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  lg: "18px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "30px",
  "4xl": "36px",
  "5xl": "48px",
  "6xl": "60px",
};

const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

const lineHeight = {
  tight: "1.15",
  snug: "1.3",
  normal: "1.5",
  relaxed: "1.7",
};

/**
 * Type pairing (documented brand choice):
 *  - display — Bricolage Grotesque. An editorial contemporary grotesque with real
 *    character; carries all headline personality. Used with restraint at large sizes
 *    and tight tracking. Gallery-placard / marquee voice.
 *  - sans — Manrope. A clean geometric-humanist workhorse that recedes so artwork and
 *    data stay the hero. Every dense ops surface uses this.
 *  - mono — JetBrains Mono. The utility voice: uppercase tracked micro-labels
 *    ("eyebrows"), timestamps, IDs, agent-log lines, flash-sheet numbering.
 *  - hand — Caveat. The hand-marked voice, used SPARINGLY: annotations,
 *    empty-state hand-notes, congrats moments, and "stamped" price marks. NEVER
 *    body text, never a control label, never a data value. One hand-note per
 *    surface is the ceiling — it should feel like the artist wrote on the wall.
 *
 * Loaded on web via next/font/local (CSS variables) and on mobile via
 * @expo-google-fonts. Stacks below are plain family names + system fallbacks so the
 * tokens stay platform-neutral; each app wires the real loaded faces in front.
 */
const fontFamily = {
  display: [
    "Bricolage Grotesque",
    "Manrope",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "sans-serif",
  ],
  hand: ["Caveat", "Bricolage Grotesque", "ui-sans-serif", "cursive"],
  sans: [
    "Manrope",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  mono: [
    "JetBrains Mono",
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "monospace",
  ],
};

// --- Elevation / shadow language --------------------------------------------
// Dark UI leans on solid surface layering + hairline borders rather than heavy
// shadows. The old expressive violet `glow` halo was RETIRED in the 2026-07
// restyle (it read as AI-generated). Emphasis is now carried by SOLID violet
// plates (surface.plate) and decisive borders, not light bloom.
//   `plate` — a tight, opaque drop that seats a placard/stamp on the wall.
//   `glow`  — DEPRECATED. Kept only so any un-swept `shadow-glow` reference
//             still compiles; it now resolves to the neutral `plate` lift with
//             no violet bloom. Do not reach for it in new code.
const boxShadow = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.40)",
  md: "0 4px 16px -4px rgba(0, 0, 0, 0.55)",
  lg: "0 16px 48px -12px rgba(0, 0, 0, 0.65)",
  plate: "0 2px 0 0 rgba(0, 0, 0, 0.55), 0 6px 20px -10px rgba(0, 0, 0, 0.7)",
  glow: "0 2px 0 0 rgba(0, 0, 0, 0.55), 0 6px 20px -10px rgba(0, 0, 0, 0.7)",
};

// --- Motion ------------------------------------------------------------------
const duration = {
  fast: "120ms",
  base: "180ms",
  slow: "260ms",
};
const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
};

const tokens = {
  colors: {
    primary,
    ember,
    neutral,
    success,
    warning,
    danger,
    info,
    paper,
    semantic,
    // Both on-screen themes (semantic === themes.dark). Read per-scheme in JS.
    themes,
  },
  spacing,
  radii,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  boxShadow,
  duration,
  easing,
};

module.exports = tokens;
module.exports.tokens = tokens;
module.exports.default = tokens;
