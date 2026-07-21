import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** On = green dot, Off = soft gray dot. */
  on?: boolean;
  /** Optional trailing label (e.g. "On" / "Off", a staff name/state). */
  label?: ReactNode;
  className?: string;
}

/**
 * Staff-status pattern: a small green ON dot / gray OFF dot. Green is a status
 * signal here (not the red reserved for counts & medical). Used for AI-staff
 * and human availability. Label optional.
 */
export function StatusDot({ on = false, label, className, ...props }: StatusDotProps) {
  return (
    <span
      className={cx("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block h-2 w-2 shrink-0 rounded-full",
          on ? "bg-success-500" : "bg-neutral-500",
        )}
      />
      {label != null && (
        <span className="text-sm text-content-secondary">{label}</span>
      )}
    </span>
  );
}
