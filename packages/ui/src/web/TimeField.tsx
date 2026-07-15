import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "../cx";
import { fieldBase } from "./Input";
import { Icon } from "./Icon";

export type TimeFieldSize = "sm" | "md" | "lg";

const sizes: Record<TimeFieldSize, string> = {
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
};

export interface TimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  size?: TimeFieldSize;
  invalid?: boolean;
}

export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(
  function TimeField({ size = "md", invalid = false, className, ...props }, ref) {
    return (
      <div className={cx("relative", className)}>
        <input
          ref={ref}
          type="time"
          aria-invalid={invalid || undefined}
          className={cx(
            fieldBase,
            sizes[size],
            "pl-3 pr-9",
            invalid ? "border-danger-500" : "border-border",
            // The native WebKit/Chromium picker indicator would double up with
            // our custom clock glyph. Make it invisible but stretch it over the
            // right edge (on top of the custom icon) so clicking the clock still
            // opens the native picker — exactly one visible affordance.
            "[&::-webkit-calendar-picker-indicator]:absolute",
            "[&::-webkit-calendar-picker-indicator]:right-0",
            "[&::-webkit-calendar-picker-indicator]:top-0",
            "[&::-webkit-calendar-picker-indicator]:h-full",
            "[&::-webkit-calendar-picker-indicator]:w-9",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "[&::-webkit-calendar-picker-indicator]:opacity-0",
          )}
          {...props}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
          <Icon name="clock" size={16} />
        </span>
      </div>
    );
  },
);
