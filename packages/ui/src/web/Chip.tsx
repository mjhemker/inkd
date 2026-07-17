import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  leadingIcon?: ReactNode;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
}

export function Chip({
  selected = false,
  disabled,
  leadingIcon,
  onRemove,
  children,
  className,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <span
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
        selected
          ? "border-brand bg-brand text-brand-on"
          : "border-border bg-surface-raised text-content-secondary hover:border-border-strong",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <button
        type={type}
        disabled={disabled}
        aria-pressed={selected}
        className="inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-full"
        {...props}
      >
        {leadingIcon && <span className="inline-flex">{leadingIcon}</span>}
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          disabled={disabled}
          className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-content-muted outline-none hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          <Icon name="x" size={12} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}
