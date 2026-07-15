import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "ember"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";
export type BadgeSize = "sm" | "md";

// Solid "stamps": opaque plates with high-contrast ink, not low-opacity tints.
const base =
  "inline-flex items-center gap-1 rounded-sm font-sans font-semibold whitespace-nowrap";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-overlay text-content-secondary",
  brand: "bg-brand text-brand-on",
  // Ember stamp — flash drops / price marks. Warm plate, dark ink.
  ember: "bg-surface-ember text-brand-on-ember",
  success: "bg-success-600 text-neutral-50",
  warning: "bg-warning-600 text-neutral-50",
  danger: "bg-danger-600 text-neutral-50",
  info: "bg-info-600 text-neutral-50",
  outline: "bg-transparent text-content-secondary border border-border",
};

const sizes: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-xs",
  md: "h-6 px-2.5 text-xs",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  size = "md",
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}
