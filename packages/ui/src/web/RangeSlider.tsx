"use client";

import { useId } from "react";
import { cx } from "../cx";

export interface RangeSliderProps {
  /** Current [low, high] value. Always kept low <= high by the component. */
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  /** Render the value labels (defaults to the raw numbers). */
  formatValue?: (v: number) => string;
  className?: string;
}

/**
 * Dual-thumb range slider (two overlaid native range inputs). The lower and
 * upper thumbs cannot cross; the filled bar between them is the selected range.
 * Built keyless/dependency-free to match the single-thumb Slider primitive.
 */
export function RangeSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  formatValue = (v) => String(v),
  className,
}: RangeSliderProps) {
  const id = useId();
  const span = max - min || 1;
  const [low, high] = value;
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  const setLow = (v: number) => onValueChange([Math.min(v, high), high]);
  const setHigh = (v: number) => onValueChange([low, Math.max(v, low)]);

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-content-primary">{label}</span>
          <span className="font-mono text-xs tabular-nums text-content-muted">
            {formatValue(low)} – {formatValue(high)}
          </span>
        </div>
      )}
      <div className="relative h-5">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[rgb(26_26_29)]" />
        {/* Selected range */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%` }}
        />
        {/* Low thumb input */}
        <input
          id={`${id}-low`}
          type="range"
          aria-label={label ? `${label} minimum` : "minimum"}
          min={min}
          max={max}
          step={step}
          value={low}
          disabled={disabled}
          onChange={(e) => setLow(Number(e.target.value))}
          // Raise the low input's stacking when both thumbs sit at the top end so
          // it stays grabbable.
          className={cx("inkd-range", low > max - (max - min) * 0.1 && "inkd-range--top")}
        />
        {/* High thumb input */}
        <input
          id={`${id}-high`}
          type="range"
          aria-label={label ? `${label} maximum` : "maximum"}
          min={min}
          max={max}
          step={step}
          value={high}
          disabled={disabled}
          onChange={(e) => setHigh(Number(e.target.value))}
          className="inkd-range"
        />
      </div>
      <style>{`
        .inkd-range {
          position: absolute;
          left: 0; top: 0;
          width: 100%;
          height: 20px;
          margin: 0;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          pointer-events: none;
          outline: none;
        }
        .inkd-range--top { z-index: 4; }
        .inkd-range::-webkit-slider-runnable-track {
          height: 20px; background: transparent;
        }
        .inkd-range::-moz-range-track { height: 20px; background: transparent; }
        .inkd-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          pointer-events: auto;
          height: 16px; width: 16px; border-radius: 9999px;
          background: #7C3AED; border: 2px solid #FAFAFA; cursor: pointer;
          transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .inkd-range::-webkit-slider-thumb:hover { transform: scale(1.12); }
        .inkd-range::-moz-range-thumb {
          pointer-events: auto;
          height: 16px; width: 16px; border-radius: 9999px;
          background: #7C3AED; border: 2px solid #FAFAFA; cursor: pointer;
        }
        .inkd-range:disabled::-webkit-slider-thumb { cursor: not-allowed; opacity: 0.5; }
        .inkd-range:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.4);
        }
      `}</style>
    </div>
  );
}
