/**
 * Presentational building blocks for the waitlist (Wave 2), mobile. Pure props
 * in — no data access — so they stay simple and reusable across the client and
 * artist screens.
 */
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Badge, Button, Card, Chip, Icon, type BadgeVariant } from "@inkd/ui/native";
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
  return days.slice().sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ");
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
    <Card className="border-brand/40">
      <View className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/15">
              <Icon name="sparkles" size={18} />
            </View>
            <View>
              <Text className="text-sm font-semibold text-content-primary">A spot opened up</Text>
              <Text className="text-xs text-content-muted">with {offer.artistName}</Text>
            </View>
          </View>
          <View className={"rounded-full px-3 py-1 " + (expired ? "bg-surface-overlay" : "bg-brand")}>
            <Text
              className={"text-xs font-semibold " + (expired ? "text-content-muted" : "text-brand-on")}
            >
              {expired ? "Expired" : `${formatCountdown(remaining)} left`}
            </Text>
          </View>
        </View>

        <View className="rounded-sm border border-border-subtle bg-surface-base px-4 py-3">
          <Text className="text-sm font-medium text-content-primary">{formatSlot(offer.slotStart)}</Text>
          {offer.serviceName ? (
            <Text className="text-xs text-content-muted">{offer.serviceName}</Text>
          ) : null}
        </View>

        <View className="flex-row gap-2">
          <Button onPress={onClaim} disabled={busy || expired} className="flex-1">
            Claim this spot
          </Button>
          <Button variant="ghost" onPress={onDecline} disabled={busy || expired}>
            Pass
          </Button>
        </View>
      </View>
    </Card>
  );
}

export interface EntryCardData {
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

export function WaitlistEntryCard({
  entry,
  onCancel,
  showClient = false,
  busy = false,
}: {
  entry: EntryCardData;
  onCancel?: () => void;
  showClient?: boolean;
  busy?: boolean;
}) {
  const weekdays = formatWeekdays(entry.preferredWeekdays);
  const timeBand = formatTimeBand(entry.preferredTimeStart, entry.preferredTimeEnd);
  const title = showClient ? entry.clientName : entry.artistName;
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            {title ? (
              <Text className="text-sm font-semibold text-content-primary">{title}</Text>
            ) : null}
            <WaitlistStatusBadge status={entry.status} />
          </View>
          <Text className="mt-1 text-sm text-content-secondary">
            {(entry.serviceName ?? "Any service") + " · " + formatDateRange(entry.earliestDate, entry.latestDate)}
          </Text>
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {weekdays ? <Chip selected={false}>{weekdays}</Chip> : null}
            {timeBand ? <Chip selected={false}>{timeBand}</Chip> : null}
          </View>
          {entry.note ? (
            <Text className="mt-2 text-xs italic text-content-muted">“{entry.note}”</Text>
          ) : null}
        </View>
        {onCancel && (entry.status === "active" || entry.status === "offered") ? (
          <Button variant="ghost" size="sm" onPress={onCancel} disabled={busy}>
            Leave
          </Button>
        ) : null}
      </View>
    </Card>
  );
}
