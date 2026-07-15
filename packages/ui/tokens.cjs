/**
 * INKD design tokens — the single source of truth for color, spacing, radii and
 * type scale across web (Tailwind v4) and mobile (NativeWind v4).
 *
 * Authored as CommonJS so the Tailwind preset (plain JS, loaded by the Tailwind
 * engine at build time) can `require()` it directly, while `tokens.d.ts` gives
 * TypeScript consumers full types.
 *
 * Brand direction: near-black canvas + violet-purple primary.
 */

// --- Violet / purple primary ramp (brand accent, #7C3AED family) -------------
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
 * feature code. Values assume the default dark (near-black) theme.
 */
const semantic = {
  surface: {
    base: neutral[950], // app canvas
    raised: neutral[900], // cards, sheets
    overlay: neutral[800], // popovers, menus
    inverse: neutral[50],
  },
  text: {
    primary: neutral[50],
    secondary: neutral[300],
    muted: neutral[400],
    inverse: neutral[950],
    accent: primary[400],
  },
  border: {
    subtle: neutral[800],
    default: neutral[700],
    strong: neutral[600],
    accent: primary[600],
  },
  brand: {
    primary: primary[600],
    primaryHover: primary[500],
    primaryActive: primary[700],
    onPrimary: neutral[50],
  },
  status: {
    success: success[500],
    warning: warning[500],
    danger: danger[500],
    info: info[500],
  },
};

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

// --- Radii -------------------------------------------------------------------
const radii = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  "3xl": "32px",
  full: "9999px",
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

const fontFamily = {
  sans: [
    "Inter",
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
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "monospace",
  ],
};

const tokens = {
  colors: {
    primary,
    neutral,
    success,
    warning,
    danger,
    info,
    semantic,
  },
  spacing,
  radii,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
};

module.exports = tokens;
module.exports.tokens = tokens;
module.exports.default = tokens;
