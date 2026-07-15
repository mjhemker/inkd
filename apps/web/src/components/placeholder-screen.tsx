import type { ReactNode } from "react";
import { EmptyState, Eyebrow, Icon, type IconName } from "@inkd/ui/web";
import { LinkButton } from "@/components/link-button";

/**
 * Standard placeholder for routes other agents will fill. A gallery-quiet screen
 * header (mono eyebrow + display title) over an EmptyState that reads as an
 * invitation to act, in INKD's voice.
 */
export function PlaceholderScreen({
  eyebrow,
  title,
  subtitle,
  icon,
  emptyTitle,
  description,
  actionLabel,
  actionHref,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  emptyTitle: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-xl text-content-secondary">{subtitle}</p>
        )}
      </header>

      {children}

      <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
        <EmptyState
          icon={<Icon name={icon} size={26} />}
          title={emptyTitle}
          description={description}
          action={
            actionLabel && actionHref ? (
              <LinkButton href={actionHref} size="sm">
                {actionLabel}
              </LinkButton>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
