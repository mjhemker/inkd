"use client";

import { useId } from "react";
import { cx } from "../cx";

export interface RadioGroupOption {
  label: string;
  value: string;
  description?: string;
}

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioGroupOption[];
  name?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  name,
  disabled = false,
  className,
}: RadioGroupProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <div role="radiogroup" className={cx("flex flex-col gap-3", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        const optionId = `${groupName}-${option.value}`;
        return (
          <div key={option.value} className="flex items-start gap-2.5">
            <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
              <input
                id={optionId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onValueChange(option.value)}
                className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
              />
              <span
                aria-hidden="true"
                className={cx(
                  "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
                  selected ? "border-border-accent bg-surface-raised" : "border-border bg-surface-raised",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base",
                  disabled && "opacity-50",
                )}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </span>
            </span>
            <label
              htmlFor={optionId}
              className={cx(
                "flex flex-col gap-0.5",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              <span className="text-sm font-medium text-content-primary">
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-content-muted">
                  {option.description}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </div>
  );
}
