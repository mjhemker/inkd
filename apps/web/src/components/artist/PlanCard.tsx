import { Card, Icon } from "@inkd/ui/web";
import { PLAN_FEATURES } from "@inkd/core";
import { ProStamp } from "./ProStamp";

/**
 * "INKD Pro — coming soon" placard. No payment CTA — subscriptions aren't
 * live yet (SPEC §0). Honest framing: every pilot artist already has every
 * feature below for free (api/plan.ts PILOT_ALL_FEATURES_FREE); this card
 * previews what becomes a paid tier once billing ships.
 */
export function PlanCard() {
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-overlay text-content-accent">
            <Icon name="sparkles" size={19} />
          </span>
          <div className="flex flex-col">
            <span className="flex items-center gap-2 text-base font-semibold text-content-primary">
              INKD Pro
              <ProStamp />
            </span>
            <span className="text-xs text-content-muted">Coming soon</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-content-secondary">
        During the pilot, every feature below is included free on your account
        — no catch. When subscriptions launch, these become the INKD Pro tier;
        we&apos;ll tell you well before anything changes for you.
      </p>

      <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
        {PLAN_FEATURES.map((f) => (
          <li key={f.key} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-sm font-medium text-content-primary">{f.label}</span>
            <span className="text-xs text-content-muted">{f.description}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
