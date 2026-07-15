"use client";

import Link from "next/link";
import { Badge, Card, Icon, cx } from "@inkd/ui/web";
import type { AgentSettings } from "@inkd/core";

import { AUTONOMY_LABEL, STAFF } from "./meta";

/**
 * The staff overview — Front Desk + Booking Manager presented as your team,
 * with mono nameplates, an on/off state, the current autonomy level (linking
 * to the settings slider), and the count of things waiting on you.
 */
export function StaffOverviewHeader({
  settings,
  pendingCount,
}: {
  settings: AgentSettings | null | undefined;
  pendingCount: number;
}) {
  const autonomy = settings?.autonomy ?? "draft_only";
  const enabledByRole: Record<string, boolean> = {
    front_desk: settings?.front_desk_enabled ?? true,
    booking_manager: settings?.booking_manager_enabled ?? true,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
            Your studio · AI staff
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-content-primary sm:text-4xl">
            AI staff
          </h1>
          <p className="max-w-xl text-content-secondary">
            Your Front Desk and Booking Manager, working from your published info.
            Everything they do is here for you to see, approve, or correct.
          </p>
        </div>
        <Link
          href="/settings?tab=ai"
          className="inline-flex items-center gap-2 rounded-sm border border-border-subtle bg-surface-raised px-3 py-2 transition-colors hover:border-border-accent"
        >
          <span className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              Autonomy
            </span>
            <span className="text-sm font-semibold text-content-primary">
              {AUTONOMY_LABEL[autonomy] ?? autonomy}
            </span>
          </span>
          <Icon name="settings" size={16} className="text-content-muted" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        {STAFF.map((staff) => {
          const on = enabledByRole[staff.role] ?? true;
          return (
            <Card key={staff.role} padding="md" className="flex items-start gap-3">
              <span
                className={cx(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-sm",
                  on
                    ? "bg-surface-ember text-brand-on-ember"
                    : "bg-surface-overlay text-content-muted",
                )}
              >
                <Icon name={staff.icon} size={19} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-content-primary">
                    {staff.name}
                  </span>
                  <Badge variant={on ? "success" : "neutral"} size="sm">
                    {on ? "On" : "Off"}
                  </Badge>
                </span>
                <span className="text-xs leading-snug text-content-muted">
                  {staff.title}
                </span>
              </div>
            </Card>
          );
        })}

        <Card
          padding="md"
          className="flex flex-col items-start justify-center gap-0.5 lg:min-w-[8rem]"
        >
          <span className="font-display text-3xl font-bold tracking-tight text-content-primary">
            {pendingCount}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-content-muted">
            Awaiting your ok
          </span>
        </Card>
      </div>
    </div>
  );
}
