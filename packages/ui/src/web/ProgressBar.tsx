import { cx } from "../cx";

export type ProgressBarSize = "sm" | "md";

const trackSizes: Record<ProgressBarSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
};

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: ProgressBarSize;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = "md",
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-content-muted">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className={cx(
          "w-full overflow-hidden rounded-full bg-surface-overlay",
          trackSizes[size],
        )}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
