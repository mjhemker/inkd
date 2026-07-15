"use client";

import { useId } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  invalid = false,
  className,
}: CheckboxProps) {
  const id = useId();

  return (
    <div className={cx("flex items-start gap-2.5", className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md outline-none disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
            checked
              ? "border-border-accent bg-brand text-brand-on"
              : invalid
                ? "border-danger-500 bg-surface-raised"
                : "border-border bg-surface-raised",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base",
            disabled && "opacity-50",
          )}
        >
          {checked && <Icon name="check" size={13} strokeWidth={2.5} />}
        </span>
      </span>
      {(label || description) && (
        <label htmlFor={id} className={cx("flex flex-col gap-0.5", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
          {label && (
            <span className="text-sm font-medium text-content-primary">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-content-muted">{description}</span>
          )}
        </label>
      )}
    </div>
  );
}
