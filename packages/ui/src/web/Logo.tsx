import type { CSSProperties } from "react";

/**
 * INKD brand mark.
 *
 * A geometric monogram in the wordmark's block-lettering language: a slab
 * capital "I" with an ember flash-diamond "stamped" onto its stem — the ink
 * mark (INKD = inked). Violet-600 plate, white letter, ember stamp: all three
 * brand elements in one honest, drawn shape (no clip-art). The same geometry is
 * exported to SVG for favicons + app icons (see the web/mobile brand assets).
 *
 * The plate stays brand violet in both themes so the mark reads identically on
 * a dark or a paper-white wall.
 */

// Art on a 48×48 box, shared with the generated icon SVGs.
const I_PATH = "M14 12 H34 V17 H27 V31 H34 V36 H14 V31 H21 V17 H14 Z";
const DIAMOND = "M24 19.2 L28.8 24 L24 28.8 L19.2 24 Z";

export interface LogoMarkProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
  /** Placard corner rounding (matches the app's `lg` radius at 32px). */
  rounded?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function LogoMark({
  size = 32,
  rounded = true,
  className,
  style,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="INKD"
      className={className}
      style={style}
    >
      <rect
        width="48"
        height="48"
        rx={rounded ? 10 : 0}
        fill="#7C3AED"
      />
      <path d={I_PATH} fill="#FFFFFF" />
      <path d={DIAMOND} fill="#E8A15C" />
    </svg>
  );
}

export interface LogoProps extends LogoMarkProps {
  /** Show the "INKD" wordmark beside the mark (default true). */
  wordmark?: boolean;
  /** Wordmark type size utility (Tailwind text-* class). */
  wordmarkClassName?: string;
}

/**
 * The full lockup: the monogram mark + the "INKD" wordmark set in the display
 * face. Use `LogoMark` alone for compact chrome (collapsed rails, favicons).
 */
export function Logo({
  size = 32,
  rounded = true,
  wordmark = true,
  className,
  wordmarkClassName = "text-xl",
  style,
}: LogoProps) {
  return (
    <span
      className={["inline-flex items-center gap-2.5", className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <LogoMark size={size} rounded={rounded} />
      {wordmark && (
        <span
          className={`font-display font-bold tracking-tight text-content-primary ${wordmarkClassName}`}
        >
          INKD
        </span>
      )}
    </span>
  );
}
