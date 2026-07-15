import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@inkd/ui/web";

/**
 * Server-safe button-styled Next.js Link. Mirrors @inkd/ui/web Button visuals but
 * is a plain (non-"use client") component, so server routes can style navigation
 * actions without pulling in the client `buttonVariants` reference.
 */
type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-sans font-semibold tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base";

const variants = {
  primary: "bg-brand text-brand-on hover:bg-brand-hover",
  secondary:
    "bg-surface-overlay text-content-primary border border-border hover:border-border-strong",
  ghost:
    "bg-transparent text-content-secondary hover:bg-surface-raised hover:text-content-primary",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
