"use client";

/**
 * StarRating (web) — the shared 5-star rating primitive used everywhere reviews
 * appear (profile aggregate badge, reviews tab, review rows, review-authoring
 * input, placards). Replaces the old square "stamp" marks with classic stars
 * that render HALF fills (SVG, no emoji): a per-star linear-gradient with a hard
 * stop at the fill fraction paints the left portion in ember and leaves the rest
 * an outline.
 *
 * Two modes off the same component:
 *  - DISPLAY (default / `readOnly`): `value` (0–5) is rounded to the nearest
 *    half and drawn. `role="img"` with an "X of 5" label.
 *  - INPUT (`onChange` set, not `readOnly`): a `role="slider"` — precise pointers
 *    (mouse/pen) pick half stars when `allowHalf`; keyboard arrows step by half;
 *    coarse pointers fall back to whole-star taps. The value passed to `onChange`
 *    is the display value; the DB numeric rating is unchanged by this component.
 */
import { useId, useRef, useState } from "react";
import { cx } from "../cx";
import {
  STAR_COUNT,
  roundToHalf,
  starFillFractions,
  ratingFromRatio,
  stepRating,
} from "../starRating/starMath";

const SIZE_PX: Record<"sm" | "md" | "lg", number> = { sm: 16, md: 24, lg: 36 };
const RATING_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Exceptional",
};
// Material-style 5-point star on a 0 0 24 24 box.
const STAR_PATH =
  "M12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.62 12 2 9.19 8.62 2 9.24 7.45 13.97 5.82 21Z";

export interface StarRatingProps {
  /** Current rating 0–5. Display rounds to the nearest half. */
  value: number;
  /** Provide to enable INPUT mode (unless `readOnly`). */
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  /** Show a text label ("Great" / "Tap to rate") beneath the stars. */
  showLabel?: boolean;
  /** Allow half-star precision on fine pointers + keyboard. Default true. */
  allowHalf?: boolean;
  className?: string;
}

/** One star: gradient-filled `fraction` of the way across, then an outline. */
function Star({ fraction, px, gid }: { fraction: number; px: number; gid: string }) {
  const clamped = fraction <= 0 ? 0 : fraction >= 1 ? 1 : fraction;
  const pct = `${clamped * 100}%`;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset={pct} stopColor="rgb(var(--color-surface-ember))" />
          <stop offset={pct} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d={STAR_PATH}
        fill={`url(#${gid})`}
        stroke="rgb(var(--color-border-strong))"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  showLabel = false,
  allowHalf = true,
  className,
}: StarRatingProps) {
  const px = SIZE_PX[size];
  const uid = useId();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readOnly && Boolean(onChange);

  const shown = interactive ? (hover ?? value) : value;
  const fractions = starFillFractions(shown);
  const rounded = roundToHalf(shown);
  const labelText =
    rounded > 0 ? RATING_LABELS[Math.round(rounded)] ?? `${rounded} of 5` : interactive ? "Tap to rate" : "No rating";

  function ratioFromEvent(clientX: number): number {
    const el = rowRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  }

  const stars = (
    <div
      ref={rowRef}
      className="flex items-center gap-0.5"
      style={{ lineHeight: 0 }}
      onPointerMove={
        interactive
          ? (e) => {
              // Fine pointers (mouse/pen) get half precision; touch stays coarse.
              const half = allowHalf && e.pointerType !== "touch";
              setHover(ratingFromRatio(ratioFromEvent(e.clientX), half));
            }
          : undefined
      }
      onPointerLeave={interactive ? () => setHover(null) : undefined}
      onPointerDown={
        interactive
          ? (e) => {
              const half = allowHalf && e.pointerType !== "touch";
              onChange?.(ratingFromRatio(ratioFromEvent(e.clientX), half));
            }
          : undefined
      }
    >
      {fractions.map((frac, i) => (
        <Star key={i} fraction={frac} px={px} gid={`${uid}-s${i}`} />
      ))}
    </div>
  );

  return (
    <div className={cx("inline-flex flex-col gap-1.5", className)}>
      {interactive ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Rating out of 5"
          aria-valuemin={0}
          aria-valuemax={STAR_COUNT}
          aria-valuenow={rounded}
          aria-valuetext={`${rounded} of 5`}
          className="inline-flex w-fit cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange?.(stepRating(value, +1, allowHalf));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange?.(stepRating(value, -1, allowHalf));
            } else if (e.key === "Home") {
              e.preventDefault();
              onChange?.(0);
            } else if (e.key === "End") {
              e.preventDefault();
              onChange?.(STAR_COUNT);
            }
          }}
        >
          {stars}
        </div>
      ) : (
        <div role="img" aria-label={`Rated ${roundToHalf(value)} of 5`}>
          {stars}
        </div>
      )}
      {showLabel && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {labelText}
        </span>
      )}
    </div>
  );
}
