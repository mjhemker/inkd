import { cx } from "@inkd/ui/web";

/**
 * The mono "PRO" stamp — same small solid-ink-plate treatment as the AI
 * staff's TierStamp (apps/web/src/components/ai-staff/TierStamp.tsx), used
 * wherever a premium-tier feature (api/plan.ts PLAN_FEATURES) is previewed.
 * Purely a label — it never gates anything (see PILOT_ALL_FEATURES_FREE).
 */
export function ProStamp({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center rounded-sm bg-surface-plate-ink px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-content-accent",
        className,
      )}
    >
      PRO
    </span>
  );
}
