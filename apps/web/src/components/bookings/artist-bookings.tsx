"use client";

/**
 * Artist bookings cockpit: a requests inbox (triage), a pipeline board by stage,
 * and a sessions calendar. Tabs keep it one surface without touching nav.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
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
  type BookingRequest,
  type Booking,
  type Session,
  type PipelineStage,
  type StatusTone,
} from "@inkd/core";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Icon,
  Tabs,
} from "@inkd/ui/web";
import { StatusBadge, formatDay, formatTime } from "./shared";

type View = "inbox" | "pipeline" | "calendar";

export function ArtistBookings({
  artistId,
}: {
  artistId: string;
  artistProfileId: string;
}) {
  const [view, setView] = useState<View>("inbox");
  const requestsQ = useArtistBookingRequests(artistId);
  const bookingsQ = useArtistBookings(artistId);

  const requests = requestsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const openCount = requests.filter((r) => isRequestOpen(r.status)).length;
  const activeCount = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Eyebrow>Studio · Pipeline</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Bookings
        </h1>
        <p className="max-w-xl text-content-secondary">
          Every request from first inquiry to healed and rebooked.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="New requests" value={String(openCount)} icon="message-circle" />
        <StatTile label="Active bookings" value={String(activeCount)} icon="calendar" />
        <StatTile label="Total requests" value={String(requests.length)} icon="trending-up" />
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as View)}
        items={[
          { value: "inbox", label: "Inbox" },
          { value: "pipeline", label: "Pipeline" },
          { value: "calendar", label: "Calendar" },
        ]}
      />

      {view === "inbox" && (
        <InboxView requests={requests} loading={requestsQ.isLoading} />
      )}
      {view === "pipeline" && (
        <PipelineView bookings={bookings} loading={bookingsQ.isLoading} />
      )}
      {view === "calendar" && <CalendarView artistId={artistId} />}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: "message-circle" | "calendar" | "trending-up";
}) {
  return (
    <Card padding="md" className="flex flex-col gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-overlay text-content-accent">
        <Icon name={icon} size={18} />
      </span>
      <span className="font-display text-2xl font-bold tracking-tight">{value}</span>
      <span className="text-sm text-content-secondary">{label}</span>
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
  const open = requests.filter((r) => isRequestOpen(r.status));
  const handled = requests.filter((r) => !isRequestOpen(r.status));

  if (!loading && requests.length === 0) {
    return (
      <Card padding="none" className="overflow-hidden">
        <EmptyState
          className="py-14"
          icon={<Icon name="message-circle" size={26} />}
          title="No requests yet"
          description="When a client sends a booking request, it lands here to triage — accept, ask a question, or decline."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          Needs review {open.length > 0 && <span className="text-content-accent">· {open.length}</span>}
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-content-muted">You&apos;re all caught up.</p>
        ) : (
          open.map((r) => <RequestRow key={r.id} request={r} />)
        )}
      </div>
      {handled.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Handled
          </h2>
          {handled.map((r) => (
            <RequestRow key={r.id} request={r} muted />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
  muted,
}: {
  request: BookingRequest;
  muted?: boolean;
}) {
  const meta = REQUEST_STATUS_META[request.status];
  return (
    <Link href={`/bookings/requests/${request.id}`} className="group block">
      <Card
        padding="md"
        variant="interactive"
        className={muted ? "opacity-70" : undefined}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-base font-bold tracking-tight">
                {request.placement || request.description?.slice(0, 44) || "Custom project"}
              </span>
              <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
              {request.has_medical_flags && (
                <Badge variant="warning">
                  <Icon name="shield" size={11} /> Medical
                </Badge>
              )}
            </div>
            <span className="font-mono text-xs text-content-muted">
              {formatDay(request.created_at)} · Budget{" "}
              {formatBudget(request.budget_min_cents, request.budget_max_cents)}
              {request.is_first_tattoo ? " · First tattoo" : ""}
            </span>
          </div>
          <Icon
            name="chevron-right"
            size={18}
            className="text-content-muted transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </Card>
    </Link>
  );
}

// --- Pipeline board ---------------------------------------------------------
function PipelineView({
  bookings,
  loading,
}: {
  bookings: Booking[];
  loading: boolean;
}) {
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
          className="py-14"
          icon={<Icon name="layout-grid" size={26} />}
          title="No bookings in the pipeline"
          description="Accept a request from the inbox and it starts moving through here — deposit, scheduled, in progress, healed."
        />
      </Card>
    );
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage) => {
        const items = columns.get(stage.key) ?? [];
        return (
          <div key={stage.key} className="flex w-64 shrink-0 flex-col gap-2 px-1">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
                {stage.label}
              </span>
              <Badge variant="neutral" size="sm">
                {items.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-subtle py-6 text-center text-xs text-content-muted">
                  Empty
                </div>
              ) : (
                items.map((b) => <PipelineCard key={b.id} booking={b} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ booking }: { booking: Booking }) {
  return (
    <Link href={`/bookings/${booking.id}`} className="block">
      <Card padding="sm" variant="interactive" className="flex flex-col gap-2">
        <span className="line-clamp-2 font-sans text-sm font-semibold text-content-primary">
          {booking.title ?? "Tattoo project"}
        </span>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            {formatDay(booking.updated_at)}
          </span>
          <Icon name="chevron-right" size={14} className="text-content-muted" />
        </div>
      </Card>
    </Link>
  );
}

// --- Calendar ---------------------------------------------------------------
const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-neutral-500",
  brand: "bg-brand",
  info: "bg-info-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

function CalendarView({ artistId }: { artistId: string }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [mode, setMode] = useState<"month" | "week">("month");

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59);
  const sessionsQ = useArtistSessions(artistId, {
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessionsQ.data ?? []) {
      if (!s.scheduled_start) continue;
      const key = new Date(s.scheduled_start).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [sessionsQ.data]);

  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function shift(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <Icon name="chevron-left" size={18} />
          </Button>
          <span className="min-w-40 text-center font-display text-lg font-bold tracking-tight">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <Icon name="chevron-right" size={18} />
          </Button>
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "month" | "week")}
          items={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-content-muted">
        {(["scheduled", "confirmed", "completed", "cancelled"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TONE_DOT[SESSION_STATUS_META[s].tone]}`} />
            {SESSION_STATUS_META[s].label}
          </span>
        ))}
      </div>

      {mode === "month" ? (
        <MonthGrid year={cursor.year} month={cursor.month} byDay={byDay} />
      ) : (
        <WeekList year={cursor.year} month={cursor.month} byDay={byDay} />
      )}

      {!sessionsQ.isLoading && (sessionsQ.data?.length ?? 0) === 0 && (
        <p className="text-center text-sm text-content-muted">
          No sessions scheduled this month.
        </p>
      )}
    </div>
  );
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function MonthGrid({
  year,
  month,
  byDay,
}: {
  year: number;
  month: number;
  byDay: Map<string, Session[]>;
}) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const todayKey = new Date().toDateString();

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-raised">
        {DOW.map((d, i) => (
          <div
            key={i}
            className="py-2 text-center font-mono text-[10px] uppercase tracking-widest text-content-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day == null)
            return <div key={i} className="min-h-20 border-b border-r border-border-subtle bg-surface-base/40" />;
          const key = new Date(year, month, day).toDateString();
          const sessions = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className="min-h-20 border-b border-r border-border-subtle p-1.5"
            >
              <div
                className={
                  "mb-1 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] " +
                  (isToday ? "bg-brand font-bold text-brand-on" : "text-content-muted")
                }
              >
                {day}
              </div>
              <div className="flex flex-col gap-1">
                {sessions.slice(0, 3).map((s) => (
                  <SessionPill key={s.id} session={s} />
                ))}
                {sessions.length > 3 && (
                  <span className="pl-1 text-[10px] text-content-muted">
                    +{sessions.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekList({
  year,
  month,
  byDay,
}: {
  year: number;
  month: number;
  byDay: Map<string, Session[]>;
}) {
  // Show the week containing today if it's in this month, else the first week.
  const today = new Date();
  const anchor =
    today.getFullYear() === year && today.getMonth() === month
      ? today
      : new Date(year, month, 1);
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - anchor.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="flex flex-col gap-2">
      {days.map((d) => {
        const sessions = byDay.get(d.toDateString()) ?? [];
        return (
          <div
            key={d.toISOString()}
            className="flex gap-4 rounded-lg border border-border-subtle bg-surface-raised px-4 py-3"
          >
            <div className="w-14 shrink-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="font-display text-xl font-bold">{d.getDate()}</div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {sessions.length === 0 ? (
                <span className="py-1 text-sm text-content-muted">—</span>
              ) : (
                sessions.map((s) => <SessionPill key={s.id} session={s} expanded />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SessionPill({
  session,
  expanded,
}: {
  session: Session;
  expanded?: boolean;
}) {
  const meta = SESSION_STATUS_META[session.status];
  return (
    <Link
      href={`/bookings/${session.booking_id}`}
      className={
        "flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-brand " +
        (expanded
          ? "bg-surface-overlay text-content-secondary"
          : "bg-surface-overlay/70 text-content-secondary hover:bg-surface-overlay")
      }
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} />
      <span className="truncate">
        {formatTime(session.scheduled_start)}
        {expanded ? ` · Session #${session.session_number}` : ""}
      </span>
    </Link>
  );
}
