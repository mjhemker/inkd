/**
 * Shared Tailwind preset for INKD, built from the `@inkd/ui` design tokens.
 *
 * Consumed by:
 *  - apps/web  (Tailwind v4) via `@config` in globals.css
 *  - apps/mobile (NativeWind v4, Tailwind v3 config) via `presets: [...]`
 *
 * Uses Tailwind v3 config shape, which both the web `@config` compat layer and
 * NativeWind v4 understand.
 *
 * THEME LAYER (2026-07): every *semantic* color (surface/content/border/brand)
 * resolves through a CSS custom property instead of a baked hex, so a single
 * `[data-theme]` (web) / `.dark:root` (mobile) flip re-skins the whole app for
 * light mode. Values are stored as space-separated RGB channels
 * (`--color-x: 124 58 237`) and read back with `rgb(var(--x) / <alpha-value>)`
 * so Tailwind opacity modifiers (`bg-surface-base/85`) still work. The raw
 * ramps (primary/ember/neutral/status/paper) stay literal — they're the same
 * pigment in both themes; only their semantic *roles* move. Channel defaults
 * (dark) + light overrides live in each app's globals/global.css.
 */
const tokens = require("@inkd/ui/tokens");

const {
  colors,
  spacing,
  radii,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  boxShadow,
} = tokens;

/** `rgb(var(--color-x) / <alpha-value>)` — keeps Tailwind opacity modifiers. */
const v = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import("tailwindcss").Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        ember: colors.ember,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
        // Print-only paper palette (waiver export). Never used on-screen.
        paper: colors.paper,
        // Semantic aliases — prefer these in product code. Theme-variable
        // backed (see header): one `[data-theme]` / `.dark` flip re-skins all.
        surface: {
          DEFAULT: v("surface-base"),
          base: v("surface-base"),
          raised: v("surface-raised"),
          overlay: v("surface-overlay"),
          // App chrome (sidebar + header) — distinct from content surface.
          chrome: v("surface-chrome"),
          inverse: v("surface-inverse"),
          // Solid accent plates (replace old low-opacity brand tints).
          plate: v("surface-plate"),
          "plate-active": v("surface-plate-active"),
          "plate-ink": v("surface-plate-ink"),
          ember: v("surface-ember"),
        },
        content: {
          DEFAULT: v("content-primary"),
          primary: v("content-primary"),
          secondary: v("content-secondary"),
          muted: v("content-muted"),
          inverse: v("content-inverse"),
          accent: v("content-accent"),
          ember: v("content-ember"),
        },
        border: {
          DEFAULT: v("border-default"),
          subtle: v("border-subtle"),
          strong: v("border-strong"),
          accent: v("border-accent"),
          ember: v("border-ember"),
        },
        brand: {
          DEFAULT: v("brand"),
          hover: v("brand-hover"),
          active: v("brand-active"),
          on: v("brand-on"),
          "on-ember": v("brand-on-ember"),
        },
        // Zine hero offset-shadow color — ink (daylight) / ember (night).
        // Theme-var backed: `bg-hero-shadow` paints the native offset backing
        // plate; `border-hero-border` paints the thin plate border. Both swap
        // pigment on a single data-theme flip. Web uses the `.hero-offset`
        // utility / `shadow-hero` token instead.
        hero: {
          shadow: v("hero-shadow"),
          border: v("hero-border"),
        },
      },
      spacing,
      borderRadius: radii,
      fontSize,
      fontWeight,
      lineHeight,
      fontFamily,
      boxShadow,
    },
  },
};
