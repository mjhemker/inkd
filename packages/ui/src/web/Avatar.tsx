import type { HTMLAttributes } from "react";
import { cx } from "../cx";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarShape = "circle" | "square";

const sizes: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const shapes: Record<AvatarShape, string> = {
  circle: "rounded-full",
  square: "rounded-lg",
};

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  name,
  size = "md",
  shape = "circle",
  className,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-surface-overlay font-sans font-semibold text-content-secondary",
        sizes[size],
        shapes[shape],
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : name ? (
        <span aria-hidden="true">{initials(name)}</span>
      ) : null}
    </div>
  );
}
