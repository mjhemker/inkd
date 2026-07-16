"use client";

import { useId } from "react";
import { cx } from "../cx";

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  className,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-content-primary">
            {label}
          </label>
          <span className="font-mono text-xs text-content-muted">{value}</span>
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
        style={{
          background: `linear-gradient(to right, rgb(var(--color-surface-plate)) ${pct}%, rgb(var(--color-border-default)) ${pct}%)`,
        }}
        className={cx(
          "inkd-slider h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        )}
      />
      <style>{`
        .inkd-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 9999px;
          background: rgb(var(--color-surface-plate));
          border: 2px solid rgb(var(--color-surface-base));
          cursor: pointer;
          margin-top: 0;
          transition: transform 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        .inkd-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .inkd-slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 9999px;
          background: rgb(var(--color-surface-plate));
          border: 2px solid rgb(var(--color-surface-base));
          cursor: pointer;
          transition: transform 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        .inkd-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
        .inkd-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
        }
        .inkd-slider::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
}
