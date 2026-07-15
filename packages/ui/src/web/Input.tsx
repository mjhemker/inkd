import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";

export type InputSize = "sm" | "md" | "lg";

const sizes: Record<InputSize, string> = {
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
};

const paddingX: Record<InputSize, string> = {
  sm: "px-2.5",
  md: "px-3",
  lg: "px-4",
};

export const fieldBase =
  "w-full rounded-lg border bg-surface-raised font-sans text-content-primary placeholder:text-content-muted outline-none transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:cursor-not-allowed disabled:opacity-50";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    invalid = false,
    leadingIcon,
    trailingIcon,
    className,
    ...props
  },
  ref,
) {
  const hasIcons = Boolean(leadingIcon || trailingIcon);

  const inputEl = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        fieldBase,
        sizes[size],
        leadingIcon ? "pl-9" : paddingX[size],
        trailingIcon ? "pr-9" : paddingX[size],
        invalid ? "border-danger-500" : "border-border",
        !hasIcons && className,
      )}
      {...props}
    />
  );

  if (!hasIcons) {
    return inputEl;
  }

  return (
    <div className={cx("relative", className)}>
      {leadingIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
          {leadingIcon}
        </span>
      )}
      {inputEl}
      {trailingIcon && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
          {trailingIcon}
        </span>
      )}
    </div>
  );
});
