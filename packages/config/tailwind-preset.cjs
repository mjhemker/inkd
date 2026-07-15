/**
 * Shared Tailwind preset for INKD, built from the `@inkd/ui` design tokens.
 *
 * Consumed by:
 *  - apps/web  (Tailwind v4) via `@config` in globals.css
 *  - apps/mobile (NativeWind v4, Tailwind v3 config) via `presets: [...]`
 *
 * Uses Tailwind v3 config shape, which both the web `@config` compat layer and
 * NativeWind v4 understand.
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

/** @type {import("tailwindcss").Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
        // Semantic aliases — prefer these in product code.
        surface: {
          DEFAULT: colors.semantic.surface.base,
          base: colors.semantic.surface.base,
          raised: colors.semantic.surface.raised,
          overlay: colors.semantic.surface.overlay,
          inverse: colors.semantic.surface.inverse,
        },
        content: {
          DEFAULT: colors.semantic.text.primary,
          primary: colors.semantic.text.primary,
          secondary: colors.semantic.text.secondary,
          muted: colors.semantic.text.muted,
          inverse: colors.semantic.text.inverse,
          accent: colors.semantic.text.accent,
        },
        border: {
          DEFAULT: colors.semantic.border.default,
          subtle: colors.semantic.border.subtle,
          strong: colors.semantic.border.strong,
          accent: colors.semantic.border.accent,
        },
        brand: {
          DEFAULT: colors.semantic.brand.primary,
          hover: colors.semantic.brand.primaryHover,
          active: colors.semantic.brand.primaryActive,
          on: colors.semantic.brand.onPrimary,
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
