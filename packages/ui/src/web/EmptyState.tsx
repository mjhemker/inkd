import type { ReactNode } from "react";
import { cx } from "../cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-4 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-content-muted">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-sans text-base font-semibold text-content-primary">
          {title}
        </h3>
        {description && (
          <p className="max-w-sm text-sm text-content-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
