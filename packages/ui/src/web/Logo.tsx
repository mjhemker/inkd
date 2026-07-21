import type { CSSProperties } from "react";
import { COMPASS_DROP, COMPASS_POINTS, COMPASS_VIOLET } from "../brand";

/**
 * INKD brand mark — the ink-drop compass.
 *
 * One ink drop whose tip is north, with three violet points at west / east /
 * south. The geometry lives in `../brand` and is shared with the native mark
 * and the generated favicons + app icons, so the three can never drift apart.
 *
 * The mark carries no plate — it sits on the surface, and the crescent is a
 * hole rather than a white shape. The drop is drawn in `currentColor`, so it
 * takes the surrounding text colour and re-tones itself across themes for free.
 */
export type LogoTone = "auto" | "on-brand";

export interface LogoMarkProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
  /**
   * `auto` (default) — drop in the surrounding ink, points in brand violet.
   * `on-brand` — the whole mark in the surrounding ink, for violet plates where
   * violet points would vanish into the background.
   */
  tone?: LogoTone;
  className?: string;
  style?: CSSProperties;
}

/** `auto` pins the ink to the theme's body colour; `on-brand` inherits it
 *  (e.g. the `text-brand-on` of a violet pill) instead of overriding it. */
function markClass(tone: LogoTone, className?: string) {
  return [tone === "auto" ? "text-content-primary" : null, className]
    .filter(Boolean)
    .join(" ");
}

export function LogoMark({
  size = 32,
  tone = "auto",
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
      className={markClass(tone, className)}
      style={style}
    >
      <path d={COMPASS_DROP} fillRule="evenodd" fill="currentColor" />
      {COMPASS_POINTS.map((d) => (
        <path
          key={d}
          d={d}
          fill={tone === "on-brand" ? "currentColor" : COMPASS_VIOLET}
        />
      ))}
    </svg>
  );
}

export interface LogoDropMarkProps extends LogoMarkProps {
  /** Animate the ink-drop (a subtle bob). Off by default + respects the
   *  consumer's reduced-motion handling — pass false to force it static. */
  animate?: boolean;
}

/**
 * The Daily Drop mark. The compass IS an ink drop, so the drop mark and the
 * brand mark are now one glyph — kept as its own export so the Daily Drop call
 * sites still read as deliberate, and because only this one can bob.
 */
export function LogoDropMark({
  size = 32,
  tone = "auto",
  animate = false,
  className,
  style,
}: LogoDropMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="INKD Drop"
      className={markClass(tone, className)}
      style={style}
    >
      <path
        d={COMPASS_DROP}
        fillRule="evenodd"
        fill="currentColor"
        style={
          animate
            ? {
                transformOrigin: "24px 24px",
                animation: "inkd-drop-bob 2.4s ease-in-out infinite",
              }
            : undefined
        }
      />
      {COMPASS_POINTS.map((d) => (
        <path
          key={d}
          d={d}
          fill={tone === "on-brand" ? "currentColor" : COMPASS_VIOLET}
        />
      ))}
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
 * The full lockup: the mark + the "INKD" wordmark set in the display face. Use
 * `LogoMark` alone for compact chrome (collapsed rails, favicons).
 */
export function Logo({
  size = 32,
  tone = "auto",
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
      <LogoMark size={size} tone={tone} />
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
