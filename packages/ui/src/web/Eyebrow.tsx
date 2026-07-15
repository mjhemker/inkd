import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className, ...props }: EyebrowProps) {
  return (
    <span
      className={cx(
        "font-mono text-xs uppercase tracking-[0.2em] text-content-muted",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
