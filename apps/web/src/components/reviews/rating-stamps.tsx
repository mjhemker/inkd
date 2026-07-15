"use client";

/**
 * INKD's rating control: five stamped ink marks instead of generic stars —
 * small hard-edged squares, each set at a slightly different hand-stamped
 * angle, filling ember when active. Reads as a placard mark (the same family
 * as the flash-price stamp on `<CardPlacard>`) rather than a review-widget
 * cliché. Doubles as a read-only display (public profile, review cards) and
 * an interactive input (the review form) via `readOnly`/`onChange`.
 */
import { useState } from "react";
import { cx } from "@inkd/ui/web";

const MARK_ROTATIONS = [-6, 4, -3, 5, -2];
const RATING_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Exceptional",
};

const SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-3.5 w-3.5",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

export interface RatingStampsProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function RatingStamps({
  value,
  onChange,
  readOnly = false,
  size = "md",
  showLabel = false,
  className,
}: RatingStampsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readOnly && Boolean(onChange);
  const display = hover ?? value;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(null)}
        role={interactive ? "radiogroup" : undefined}
        aria-label={interactive ? "Rating out of 5" : `Rated ${value} of 5`}
      >
        {[1, 2, 3, 4, 5].map((mark) => {
          const filled = mark <= display;
          return (
            <button
              key={mark}
              type="button"
              disabled={!interactive}
              aria-label={`Rate ${mark} of 5`}
              aria-pressed={interactive ? filled : undefined}
              onMouseEnter={() => interactive && setHover(mark)}
              onFocus={() => interactive && setHover(mark)}
              onBlur={() => setHover(null)}
              onClick={() => interactive && onChange?.(mark)}
              style={{ transform: `rotate(${MARK_ROTATIONS[mark - 1]}deg)` }}
              className={cx(
                SIZES[size],
                "shrink-0 rounded-[3px] border-2 transition-colors duration-150",
                filled ? "border-border-ember bg-surface-ember" : "border-border-subtle bg-transparent",
                interactive ? "cursor-pointer hover:border-border-ember" : "cursor-default",
              )}
            />
          );
        })}
      </div>
      {showLabel && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {display > 0 ? RATING_LABELS[display] : "Tap to rate"}
        </span>
      )}
    </div>
  );
}
