"use client";

import { useEffect, useState, type HTMLAttributes } from "react";
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
  // A stored avatar URL that 404s (e.g. a deleted object, or a bad public URL)
  // must degrade to initials — never a browser broken-image icon. Reset the
  // failure flag whenever the src changes so a new upload gets a fresh try.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showImage = Boolean(src) && !failed;

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
      {showImage ? (
        <img
          src={src}
          alt={name ?? ""}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : name ? (
        <span aria-hidden="true">{initials(name)}</span>
      ) : null}
    </div>
  );
}
