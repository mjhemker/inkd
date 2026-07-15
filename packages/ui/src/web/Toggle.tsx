"use client";

import { useId } from "react";
import { cx } from "../cx";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: ToggleProps) {
  const id = useId();

  const button = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : "Toggle"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-surface-overlay",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block h-[18px] w-[18px] transform rounded-full bg-neutral-50 shadow-sm transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
          checked ? "translate-x-[22px]" : "translate-x-1",
        )}
      />
    </button>
  );

  if (!label) return button;

  return (
    <div className={cx("inline-flex items-center gap-2.5", className)}>
      {button}
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-content-primary">
        {label}
      </label>
    </div>
  );
}
