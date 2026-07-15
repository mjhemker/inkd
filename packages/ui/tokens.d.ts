/** Type declarations for the CommonJS design tokens in `tokens.cjs`. */

export type ColorRamp = Record<string | number, string>;

export interface SemanticColors {
  surface: {
    base: string;
    raised: string;
    overlay: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    accent: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    accent: string;
  };
  brand: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    onPrimary: string;
  };
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

export interface InkdColors {
  primary: ColorRamp;
  neutral: ColorRamp;
  success: ColorRamp;
  warning: ColorRamp;
  danger: ColorRamp;
  info: ColorRamp;
  semantic: SemanticColors;
}

export interface InkdTokens {
  colors: InkdColors;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  fontSize: Record<string, string>;
  fontWeight: Record<string, string>;
  lineHeight: Record<string, string>;
  fontFamily: Record<string, string[]>;
}

declare const tokens: InkdTokens;
export default tokens;
export { tokens };
