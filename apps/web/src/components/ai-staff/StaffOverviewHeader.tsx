"use client";

import Link from "next/link";
import { Badge, Card, Icon, StatusDot } from "@inkd/ui/web";
import type { AgentSettings } from "@inkd/core";

import { AUTONOMY_LABEL, STAFF } from "./meta";

/**
 * The staff overview — Front Desk, Booking Manager + Studio Manager presented as
 * your team. Zine pass: the header carries a mono "AUTONOMY · <level>" link and,
 * when anything's waiting, a red "N AWAITING YOU" stamp (red = counts & medical
 * only). The team reads as a compact status row — a StatusDot + mono nameplate +
 * ON/OFF + one line of role copy per staff, all flat hairline cards.
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
    studio_manager: settings?.studio_manager_enabled ?? true,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
            Your studio · AI staff
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-content-primary sm:text-4xl">
            AI staff
          </h1>
          <p className="max-w-xl text-content-secondary">
            Your Front Desk, Booking Manager, and Studio Manager, working from
            your published info. Everything they do is here for you to see,
            approve, or correct.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {pendingCount > 0 && (
            <Badge variant="stamp" size="md">
              {pendingCount} awaiting you
            </Badge>
          )}
          <Link
            href="/settings?tab=ai"
            className="inline-flex items-center gap-2 rounded-sm border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-content-secondary transition-colors hover:border-border-accent hover:text-content-primary"
          >
            Autonomy · {AUTONOMY_LABEL[autonomy] ?? autonomy}
            <Icon name="settings" size={13} className="text-content-muted" />
          </Link>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {STAFF.map((staff) => {
          const on = enabledByRole[staff.role] ?? true;
          return (
            <Card
              key={staff.role}
              padding="sm"
              className="flex items-start gap-2.5"
            >
              <StatusDot on={on} className="mt-1" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-content-primary">
                    {staff.name}
                  </span>
                  <span
                    className={
                      on
                        ? "font-mono text-[10px] uppercase tracking-[0.16em] text-success-600"
                        : "font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted"
                    }
                  >
                    {on ? "On" : "Off"}
                  </span>
                </span>
                <span className="text-xs leading-snug text-content-muted">
                  {staff.short}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
