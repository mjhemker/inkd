"use client";

/**
 * "Here's what INKD saw" — the trust-building panel that shows the client the
 * styles / placement / color the classifier read from their inspiration image,
 * as chips. Detected styles are tappable so the client can REFINE the search
 * (narrow to just the styles they actually want). Reinforces that the image is
 * transient (privacy) at the point of understanding.
 */
import { Icon, cx } from "@inkd/ui/web";
import type { InspirationSummary } from "@inkd/core/api";

export interface DetectedTagsPanelProps {
  summary: InspirationSummary;
  /** Style slugs currently used to narrow the search (empty = all detected). */
  activeStyleSlugs: string[];
  onToggleStyle: (slug: string) => void;
  className?: string;
}

export function DetectedTagsPanel({
  summary,
  activeStyleSlugs,
  onToggleStyle,
  className,
}: DetectedTagsPanelProps) {
  const active = new Set(activeStyleSlugs);
  const refining = activeStyleSlugs.length > 0;

  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-raised p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-content-ember">
          <Icon name="sparkles" size={15} />
        </span>
        <h2 className="font-display text-sm font-bold tracking-tight text-content-primary">
          Here&rsquo;s what INKD saw
        </h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-content-muted">
          Tap a style to focus
        </span>
      </div>

      {/* Detected styles (tappable to refine) */}
      {summary.styles.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {summary.styles.map((s) => {
            const on = !refining || active.has(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={refining && active.has(s.slug)}
                onClick={() => onToggleStyle(s.slug)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
                  on
                    ? "border-brand bg-brand text-brand-on"
                    : "border-border-subtle bg-surface-overlay text-content-secondary hover:border-border-strong",
                )}
              >
                {s.label}
                <span
                  className={cx(
                    "font-mono text-[10px] tabular-nums",
                    on ? "text-brand-on/70" : "text-content-muted",
                  )}
                >
                  {Math.round(s.confidence * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-content-secondary">
          No distinct tattoo style stood out in this image.
        </p>
      )}

      {/* Secondary attributes */}
      <div className="flex flex-wrap gap-1.5">
        <AttrChip label={summary.colorLabel} />
        {summary.placement.slice(0, 3).map((p) => (
          <AttrChip key={p} label={titleCase(p)} />
        ))}
        {summary.sizeEstimate !== "unknown" && (
          <AttrChip label={`${titleCase(summary.sizeEstimate)} scale`} />
        )}
        {summary.subjects.slice(0, 4).map((s) => (
          <AttrChip key={s} label={titleCase(s)} subtle />
        ))}
      </div>

      {refining && (
        <button
          type="button"
          onClick={() => onToggleStyle("__reset__")}
          className="w-fit font-mono text-[10px] uppercase tracking-widest text-content-muted hover:text-content-primary"
        >
          Reset to all detected styles
        </button>
      )}
    </div>
  );
}

function AttrChip({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={cx(
        "rounded-sm border px-2 py-0.5 text-xs",
        subtle
          ? "border-transparent bg-surface-overlay text-content-muted"
          : "border-border-subtle bg-surface-base text-content-secondary",
      )}
    >
      {label}
    </span>
  );
}

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
