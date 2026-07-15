import { forwardRef, type SelectHTMLAttributes } from "react";
import { cx } from "../cx";
import { fieldBase } from "./Input";
import { Icon } from "./Icon";

export type SelectSize = "sm" | "md" | "lg";

const sizes: Record<SelectSize, string> = {
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
};

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: SelectSize;
  invalid?: boolean;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      size = "md",
      invalid = false,
      options,
      placeholder,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <div className={cx("relative", className)}>
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cx(
            fieldBase,
            sizes[size],
            "appearance-none pl-3 pr-9",
            invalid ? "border-danger-500" : "border-border",
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
          <Icon name="chevron-down" size={16} />
        </span>
      </div>
    );
  },
);
