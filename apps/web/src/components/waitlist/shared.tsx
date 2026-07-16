"use client";

/**
 * Presentational building blocks for the cancellation waitlist (Wave 2), shared
 * by the connected client/artist panels and the dev preview. Pure props in —
 * no hooks / data access — so they render in screenshots and stay testable.
 */
import { useEffect, useState } from "react";
import { Badge, Button, Card, Chip, Icon, type BadgeVariant } from "@inkd/ui/web";
import { offerCountdownMs } from "@inkd/core";

const ET = "America/New_York";

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: ET,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateRange(earliest: string | null, latest: string | null): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (earliest && latest) return `${fmt(earliest)} – ${fmt(latest)}`;
  if (earliest) return `From ${fmt(earliest)}`;
  if (latest) return `Through ${fmt(latest)}`;
  return "Any date";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatWeekdays(days: number[] | null): string | null {
  if (!days || days.length === 0 || days.length === 7) return null;
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

export function formatTimeBand(start: string | null, end: string | null): string | null {
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    const d = new Date();
    d.setHours(parseInt(h ?? "0", 10), parseInt(m ?? "0", 10), 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  if (start && end) return `${fmt(start)}–${fmt(end)}`;
  if (start) return `After ${fmt(start)}`;
  if (end) return `Before ${fmt(end)}`;
  return null;
}

const ENTRY_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "On the waitlist", variant: "neutral" },
  offered: { label: "Spot offered", variant: "brand" },
  claimed: { label: "Claimed", variant: "success" },
  expired: { label: "Expired", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

export function WaitlistStatusBadge({ status }: { status: string }) {
  const meta = ENTRY_STATUS_META[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** Live countdown to a target instant, re-rendered each second. */
export function useCountdown(targetIso: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return offerCountdownMs(targetIso, new Date(now));
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export interface OfferCardData {
  id: string;
  artistName: string;
  serviceName?: string | null;
  slotStart: string;
  expiresAt: string;
}

/** The client-facing "a spot opened up" card with a live expiry countdown. */
export function WaitlistOfferCard({
  offer,
  onClaim,
  onDecline,
  busy = false,
}: {
  offer: OfferCardData;
  onClaim?: () => void;
  onDecline?: () => void;
  busy?: boolean;
}) {
  const remaining = useCountdown(offer.expiresAt);
  const expired = remaining <= 0;
  return (
    <Card className="border-brand/40 bg-brand/[0.04]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Icon name="sparkles" size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-content">A spot opened up</p>
              <p className="text-xs text-content-muted">with {offer.artistName}</p>
            </div>
          </div>
          <div
            className={
              "rounded-full px-3 py-1 text-xs font-semibold tabular-nums " +
              (expired ? "bg-surface-muted text-content-muted" : "bg-brand text-brand-on")
            }
            aria-label="Time left to claim"
          >
            {expired ? "Expired" : `${formatCountdown(remaining)} left`}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-content">{formatSlot(offer.slotStart)}</p>
          {offer.serviceName ? (
            <p className="text-xs text-content-muted">{offer.serviceName}</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button onClick={onClaim} disabled={busy || expired} className="flex-1">
            Claim this spot
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={busy || expired}>
            Pass
          </Button>
        </div>
        <p className="text-center text-[11px] text-content-muted">
          Claiming starts a booking request and your deposit — same as booking normally.
        </p>
      </div>
    </Card>
  );
}

export interface EntryRowData {
  id: string;
  artistName?: string | null;
  clientName?: string | null;
  serviceName?: string | null;
  status: string;
  earliestDate: string | null;
  latestDate: string | null;
  preferredWeekdays: number[] | null;
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  note?: string | null;
  priority?: number;
}

/** One waitlist entry — used in both the client's list and the artist's view. */
export function WaitlistEntryRow({
  entry,
  onCancel,
  showClient = false,
  busy = false,
}: {
  entry: EntryRowData;
  onCancel?: () => void;
  showClient?: boolean;
  busy?: boolean;
}) {
  const weekdays = formatWeekdays(entry.preferredWeekdays);
  const timeBand = formatTimeBand(entry.preferredTimeStart, entry.preferredTimeEnd);
  const title = showClient ? entry.clientName : entry.artistName;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {title ? <p className="text-sm font-semibold text-content">{title}</p> : null}
            <WaitlistStatusBadge status={entry.status} />
            {showClient && entry.priority ? (
              <Badge variant="neutral">Priority {entry.priority}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-content-muted">
            {entry.serviceName ?? "Any service"} · {formatDateRange(entry.earliestDate, entry.latestDate)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {weekdays ? <Chip selected={false}>{weekdays}</Chip> : null}
            {timeBand ? <Chip selected={false}>{timeBand}</Chip> : null}
          </div>
          {entry.note ? (
            <p className="mt-2 text-xs italic text-content-muted">“{entry.note}”</p>
          ) : null}
        </div>
        {onCancel && (entry.status === "active" || entry.status === "offered") ? (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Leave
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, value) => ({ label, value }));
