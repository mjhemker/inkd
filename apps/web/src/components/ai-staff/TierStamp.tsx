import { cx } from "@inkd/ui/web";
import { TIER_META } from "./meta";

/**
 * The mono tier stamp — a small solid ink plate reading "TIER n" with the
 * plain-language meaning beside it. Tier is set by the policy engine outside
 * the model, so it's stamped, not styled soft.
 */
export function TierStamp({
  tier,
  className,
  withLabel = true,
}: {
  tier: number;
  className?: string;
  withLabel?: boolean;
}) {
  const meta = TIER_META[tier] ?? { stamp: `TIER ${tier}`, label: "" };
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span className="inline-flex h-5 items-center rounded-sm bg-surface-plate-ink px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-content-accent">
        {meta.stamp}
      </span>
      {withLabel && meta.label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-content-muted">
          {meta.label}
        </span>
      )}
    </span>
  );
}
