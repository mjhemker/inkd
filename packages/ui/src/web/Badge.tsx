import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";
export type BadgeSize = "sm" | "md";

const base =
  "inline-flex items-center gap-1 rounded-md font-sans font-medium whitespace-nowrap";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-overlay text-content-secondary",
  brand: "bg-brand/15 text-content-accent",
  success: "bg-success-500/15 text-success-500",
  warning: "bg-warning-500/15 text-warning-500",
  danger: "bg-danger-500/15 text-danger-500",
  info: "bg-info-500/15 text-info-500",
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
