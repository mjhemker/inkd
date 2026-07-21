/**
 * Artist bookings cockpit: a requests inbox (triage), a pipeline (grouped by
 * stage, vertical sections for mobile), and a sessions agenda ("Calendar").
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  useArtistBookingRequests,
  useArtistBookings,
  useArtistSessions,
  REQUEST_STATUS_META,
  PIPELINE_STAGES,
  SESSION_STATUS_META,
  bookingStage,
  isRequestOpen,
  formatBudget,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  weekRangeLabel,
  monthLabel,
  type BookingRequest,
  type Booking,
  type Session,
  type PipelineStage,
  type StatusTone,
} from "@inkd/core";
import { Badge, Card, EmptyState, Eyebrow, Icon, Tabs, type IconName } from "@inkd/ui/native";
import { StatusBadge, formatDay, formatTime } from "./shared";
import { useTheme } from "@/providers/theme";

type View_ = "inbox" | "pipeline" | "calendar";

export function ArtistBookings({
  artistId,
}: {
  artistId: string;
  artistProfileId: string;
}) {
  const [view, setView] = useState<View_>("inbox");
  const requestsQ = useArtistBookingRequests(artistId);
  const bookingsQ = useArtistBookings(artistId);

  const requests = requestsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const openCount = requests.filter((r) => isRequestOpen(r.status)).length;
  const activeCount = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled",
  ).length;

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Eyebrow>Studio · Pipeline</Eyebrow>
        <Text className="font-display text-3xl text-content-primary">Bookings</Text>
        <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          {`${openCount} New · ${activeCount} Active · ${requests.length} Total`}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <StatTile label="New requests" value={String(openCount)} icon="message-circle" />
        <StatTile label="Active bookings" value={String(activeCount)} icon="calendar" />
        <StatTile label="Total requests" value={String(requests.length)} icon="trending-up" />
      </View>

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as View_)}
        items={[
          { value: "inbox", label: "Inbox" },
          { value: "pipeline", label: "Pipeline" },
          { value: "calendar", label: "Calendar" },
        ]}
      />

      {view === "inbox" && <InboxView requests={requests} loading={requestsQ.isLoading} />}
      {view === "pipeline" && <PipelineView bookings={bookings} loading={bookingsQ.isLoading} />}
      {view === "calendar" && <CalendarView artistId={artistId} />}
    </View>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Card padding="md" className="flex-1 gap-2">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay">
        <Icon name={icon} size={18} color={colors.text.accent} />
      </View>
      <Text className="font-display text-2xl text-content-primary">{value}</Text>
      <Text className="text-sm text-content-secondary">{label}</Text>
    </Card>
  );
}

// --- Inbox ------------------------------------------------------------------
function InboxView({
  requests,
  loading,
}: {
  requests: BookingRequest[];
  loading: boolean;
}) {
  const { colors } = useTheme();
  const open = requests.filter((r) => isRequestOpen(r.status));
  const handled = requests.filter((r) => !isRequestOpen(r.status));

  if (!loading && requests.length === 0) {
    return (
      <Card padding="none" className="overflow-hidden">
        <EmptyState
          icon={<Icon name="message-circle" size={26} color={colors.text.muted} />}
          title="No requests yet"
          description="When a client sends a booking request, it lands here to triage — accept, ask a question, or decline."
        />
      </Card>
    );
  }

  return (
    <View className="gap-6">
      <View className="gap-3">
        <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          Needs review{open.length > 0 ? ` · ${open.length}` : ""}
        </Text>
        {open.length === 0 ? (
          <Text className="text-sm text-content-muted">You&apos;re all caught up.</Text>
        ) : (
          <View className="gap-3">
            {/* Zine law: the top needs-review card is this screen's single hero. */}
            {open.map((r, i) => (
              <RequestRow key={r.id} request={r} hero={i === 0} />
            ))}
          </View>
        )}
      </View>
      {handled.length > 0 && (
        <View className="gap-3">
          <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Handled
          </Text>
          <View className="gap-3">
            {handled.map((r) => (
              <HandledRow key={r.id} request={r} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function requestTitle(request: BookingRequest): string {
  return request.placement || request.description?.slice(0, 44) || "Custom project";
}

function RequestRow({ request, hero }: { request: BookingRequest; hero?: boolean }) {
  const { colors } = useTheme();
  const meta = REQUEST_STATUS_META[request.status];
  return (
    <Card
      padding="md"
      variant={hero ? "default" : "interactive"}
      hero={hero}
      className="gap-3"
      onPress={() => router.push(`/bookings/requests/${request.id}`)}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="flex-1 font-display text-base text-content-primary" numberOfLines={1}>
          {requestTitle(request)}
        </Text>
        <Icon name="chevron-right" size={18} color={colors.text.muted} />
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        {request.has_medical_flags && (
          // Red is rationed to counts + medical: a red mono stamp, not a filled pill.
          <Badge variant="stamp" size="sm">Medical</Badge>
        )}
      </View>
      <Text className="font-mono text-xs text-content-muted">
        {formatDay(request.created_at)} · Budget{" "}
        {formatBudget(request.budget_min_cents, request.budget_max_cents)}
        {request.is_first_tattoo ? " · First tattoo" : ""}
      </Text>
    </Card>
  );
}

/**
 * A HANDLED request: muted flat hairline row — title + soft status chip, with a
 * mono date · budget line. No hero; these are resolved.
 */
function HandledRow({ request }: { request: BookingRequest }) {
  const { colors } = useTheme();
  const meta = REQUEST_STATUS_META[request.status];
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-sm border border-border-subtle bg-surface-raised px-4 py-3 opacity-80 active:opacity-100"
      onPress={() => router.push(`/bookings/requests/${request.id}`)}
    >
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-display text-sm text-content-secondary" numberOfLines={1}>
            {requestTitle(request)}
          </Text>
          <Badge variant="neutral" size="sm">{meta.label}</Badge>
        </View>
        <Text className="font-mono text-[11px] text-content-muted">
          {formatDay(request.created_at)} ·{" "}
          {formatBudget(request.budget_min_cents, request.budget_max_cents)}
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.text.muted} />
    </Pressable>
  );
}

// --- Pipeline (vertical sections) -------------------------------------------
function PipelineView({
  bookings,
  loading,
}: {
  bookings: Booking[];
  loading: boolean;
}) {
  const { colors } = useTheme();
  const columns = useMemo(() => {
    const map = new Map<PipelineStage, Booking[]>();
    for (const stage of PIPELINE_STAGES) map.set(stage.key, []);
    for (const b of bookings) {
      const key = bookingStage(b);
      map.get(key)?.push(b);
    }
    return map;
  }, [bookings]);

  if (!loading && bookings.length === 0) {
    return (
      <Card padding="none" className="overflow-hidden">
        <EmptyState
          icon={<Icon name="layout-grid" size={26} color={colors.text.muted} />}
          title="No bookings in the pipeline"
          description="Accept a request from the inbox and it starts moving through here — deposit, scheduled, in progress, healed."
        />
      </Card>
    );
  }

  return (
    <View className="gap-6">
      {PIPELINE_STAGES.map((stage) => {
        const items = columns.get(stage.key) ?? [];
        return (
          <View key={stage.key} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
                {stage.label}
              </Text>
              <Badge variant="neutral" size="sm">
                {String(items.length)}
              </Badge>
            </View>
            {items.length === 0 ? (
              <View className="items-center rounded-lg border border-dashed border-border-subtle py-5">
                <Text className="text-xs text-content-muted">Empty</Text>
              </View>
            ) : (
              <View className="gap-2">
                {items.map((b) => (
                  <PipelineCard key={b.id} booking={b} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function PipelineCard({ booking }: { booking: Booking }) {
  const { colors } = useTheme();
  return (
    <Card
      padding="sm"
      variant="interactive"
      className="gap-2"
      onPress={() => router.push(`/bookings/${booking.id}`)}
    >
      <Text className="font-sans-semibold text-sm text-content-primary" numberOfLines={2}>
        {booking.title ?? "Tattoo project"}
      </Text>
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {formatDay(booking.updated_at)}
        </Text>
        <Icon name="chevron-right" size={14} color={colors.text.muted} />
      </View>
    </Card>
  );
}

// --- Calendar (agenda list) --------------------------------------------------
const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-neutral-500",
  brand: "bg-brand",
  info: "bg-info-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

type CalendarMode = "week" | "month";

/**
 * Mobile keeps the agenda list (right for a phone), but adopts the same
 * period-scoped header navigation as web: a ‹ label › row where the label is
 * the exact week range ("July 12 – 18, 2026") or month ("July 2026"), a
 * week/month toggle that keeps its date anchor, and the agenda scoped to the
 * selected period.
 */
function CalendarView({ artistId }: { artistId: string }) {
  const { colors } = useTheme();
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>("week");

  const range = useMemo(() => {
    const from = mode === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
    const to = mode === "week" ? endOfWeek(anchor) : endOfMonth(anchor);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [anchor, mode]);

  const sessionsQ = useArtistSessions(artistId, range);

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessionsQ.data ?? []) {
      if (!s.scheduled_start) continue;
      const key = new Date(s.scheduled_start).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
    );
  }, [sessionsQ.data]);

  const label = mode === "week" ? weekRangeLabel(anchor) : monthLabel(anchor);
  const step = (delta: number) =>
    setAnchor((d) => (mode === "week" ? addWeeks(d, delta) : addMonths(d, delta)));

  return (
    <View className="gap-4">
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "week" ? "Previous week" : "Previous month"}
            className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay"
            onPress={() => step(-1)}
          >
            <Icon name="chevron-left" size={18} color={colors.text.secondary} />
          </Pressable>
          <Text className="flex-1 text-center font-display text-lg text-content-primary">
            {label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "week" ? "Next week" : "Next month"}
            className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay"
            onPress={() => step(1)}
          >
            <Icon name="chevron-right" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as CalendarMode)}
          items={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </View>

      <View className="flex-row flex-wrap gap-3">
        {(["scheduled", "confirmed", "completed", "cancelled"] as const).map((s) => (
          <View key={s} className="flex-row items-center gap-1.5">
            <View className={`h-2 w-2 rounded-full ${TONE_DOT[SESSION_STATUS_META[s].tone]}`} />
            <Text className="text-xs text-content-muted">{SESSION_STATUS_META[s].label}</Text>
          </View>
        ))}
      </View>

      {byDay.length === 0 ? (
        <Card padding="none" className="overflow-hidden">
          <EmptyState
            icon={<Icon name="calendar" size={26} color={colors.text.muted} />}
            title={mode === "week" ? "Nothing this week" : "Nothing this month"}
            description="Sessions you schedule in this period show up here, grouped by day. Use ‹ › to move between periods."
          />
        </Card>
      ) : (
        <View className="gap-3">
          {byDay.map(([dayKey, sessions]) => {
            const d = new Date(dayKey);
            return (
              <View
                key={dayKey}
                className="flex-row gap-4 rounded-lg border border-border-subtle bg-surface-raised px-4 py-3"
              >
                <View className="w-14 shrink-0">
                  <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text className="font-display text-xl text-content-primary">{d.getDate()}</Text>
                </View>
                <View className="flex-1 gap-1.5">
                  {sessions.map((s) => (
                    <SessionPill key={s.id} session={s} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SessionPill({ session }: { session: Session }) {
  const meta = SESSION_STATUS_META[session.status];
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-1.5 rounded bg-surface-overlay px-1.5 py-1"
      onPress={() => router.push(`/bookings/${session.booking_id}`)}
    >
      <View className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} />
      <Text className="text-[11px] text-content-secondary" numberOfLines={1}>
        {formatTime(session.scheduled_start)} · Session #{session.session_number}
      </Text>
    </Pressable>
  );
}
