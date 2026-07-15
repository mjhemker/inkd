import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export type CardVariant = "default" | "raised" | "outlined" | "interactive";
export type CardPadding = "none" | "sm" | "md" | "lg";

const variants: Record<CardVariant, string> = {
  default: "bg-surface-raised border border-border-subtle",
  raised: "bg-surface-overlay border border-border-subtle shadow-md",
  outlined: "bg-transparent border border-border",
  interactive:
    "bg-surface-raised border border-border-subtle cursor-pointer hover:border-border-strong hover:shadow-md",
};

const paddings: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children?: ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        // Placard discipline: near-square hard edge, not a soft rounded panel.
        "rounded-sm transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
        variants[variant],
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Optional museum-placard header strip. Sits flush at the top of a Card (use
 * `padding="none"` on the Card and pad the content yourself) to stamp a small
 * mono label — an artwork's medium, a section kind, a status. Mono, uppercase,
 * tracked, on a solid ink strip.
 */
export interface CardPlacardProps extends HTMLAttributes<HTMLDivElement> {
  /** Right-aligned secondary mark, e.g. a stamped price or count. */
  meta?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function CardPlacard({
  meta,
  className,
  children,
  ...props
}: CardPlacardProps) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-overlay px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {meta != null && (
        <span className="shrink-0 text-content-secondary">{meta}</span>
      )}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cx("flex flex-col gap-1.5 pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  children?: ReactNode;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={cx(
        "font-sans text-lg font-semibold text-content-primary",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export interface CardDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  children?: ReactNode;
}

export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={cx("text-sm text-content-muted", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cx("text-content-secondary", className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cx("flex items-center gap-2 pt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
