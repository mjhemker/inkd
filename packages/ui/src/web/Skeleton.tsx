import type { HTMLAttributes } from "react";
import { cx } from "../cx";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cx("animate-pulse rounded-md bg-surface-overlay", className)}
      {...props}
    />
  );
}
