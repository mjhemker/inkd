/** Type declarations for the CommonJS design tokens in `tokens.cjs`. */

export type ColorRamp = Record<string | number, string>;

export interface SemanticColors {
  surface: {
    base: string;
    raised: string;
    overlay: string;
    chrome: string;
    inverse: string;
    plate: string;
    plateActive: string;
    plateInk: string;
    ember: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    accent: string;
    ember: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    accent: string;
    ember: string;
  };
  brand: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    onPrimary: string;
    onEmber: string;
  };
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  /** Zine hero offset-shadow — ink in daylight, ember at night. */
  hero: {
    shadow: string;
    border: string;
    offset: string;
  };
  paper: {
    base: string;
    raised: string;
    ink: string;
    muted: string;
    border: string;
    accent: string;
  };
}

export interface InkdColors {
  primary: ColorRamp;
  ember: ColorRamp;
  neutral: ColorRamp;
  success: ColorRamp;
  warning: ColorRamp;
  danger: ColorRamp;
  info: ColorRamp;
  paper: ColorRamp;
  semantic: SemanticColors;
  /** Both on-screen themes. `semantic` is an alias of `themes.dark`. */
  themes: { dark: SemanticColors; light: SemanticColors };
}

/** The two on-screen color schemes. */
export type ColorScheme = "dark" | "light";

export interface InkdTokens {
  colors: InkdColors;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  fontSize: Record<string, string>;
  fontWeight: Record<string, string>;
  lineHeight: Record<string, string>;
  fontFamily: Record<string, string[]>;
  boxShadow: Record<string, string>;
  duration: Record<string, string>;
  easing: Record<string, string>;
}

declare const tokens: InkdTokens;
export default tokens;
export { tokens };
