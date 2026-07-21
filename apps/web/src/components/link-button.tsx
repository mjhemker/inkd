import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@inkd/ui/web";

/**
 * Server-safe button-styled Next.js Link. Mirrors @inkd/ui/web Button visuals but
 * is a plain (non-"use client") component, so server routes can style navigation
 * actions without pulling in the client `buttonVariants` reference.
 */
type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  /** The screen's single hero action — primary plate + the hard offset shadow
   * (ink in daylight / ember at night), matching `<Button hero>`. Opt-in per
   * screen; forces the fixed larger presence so the one hero reads uniformly. */
  hero?: boolean;
  children: ReactNode;
};

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-sans font-semibold tracking-tight outline-none transition-[background-color,border-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base";

const variants = {
  primary: "bg-brand text-brand-on hover:bg-brand-hover",
  secondary:
    "bg-surface-overlay text-content-primary border border-border hover:border-border-strong",
  ghost:
    "bg-transparent text-content-secondary hover:bg-surface-raised hover:text-content-primary",
  outline:
    "bg-transparent text-content-primary border border-border hover:border-border-accent hover:text-content-accent",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function LinkButton({
  variant = "primary",
  size = "md",
  hero = false,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={
        hero
          ? cx(base, variants.primary, "hero-offset h-12 px-6 text-base font-bold", className)
          : cx(base, variants[variant], sizes[size], className)
      }
      {...props}
    >
      {children}
    </Link>
  );
}
