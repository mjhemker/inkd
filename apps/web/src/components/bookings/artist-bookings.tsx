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
  BOOKING_STATUS_META,
  bookingStage,
  isRequestOpen,
  formatBudget,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  type BookingRequest,
  type Booking,
  type PipelineStage,
} from "@inkd/core";
import {
  Badge,
  Card,
  EmptyState,
  Eyebrow,
  Icon,
  Tabs,
  placementLabelFromColumns,
} from "@inkd/ui/web";
import { StatusBadge, formatDay } from "./shared";
import { SessionsCalendar, type CalendarMode } from "./sessions-calendar";

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
        <PipelineBoard bookings={bookings} loading={bookingsQ.isLoading} />
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
                {placementLabelFromColumns(request) ||
                  request.placement ||
                  request.description?.slice(0, 44) ||
                  "Custom project"}
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
/**
 * Full-width Kanban board. On desktop every stage is visible at once — the
 * columns flex to share the content width. As the viewport narrows the columns
 * wrap to a second row (via flex-wrap + a min-width basis) BEFORE we ever fall
 * back to horizontal scroll, which only kicks in on genuinely small screens.
 */
export function PipelineBoard({
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
    <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible lg:flex-nowrap">
      {PIPELINE_STAGES.map((stage) => {
        const items = columns.get(stage.key) ?? [];
        return (
          <div
            key={stage.key}
            className="flex w-64 shrink-0 snap-start flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised/40 p-2 sm:w-auto sm:min-w-[200px] sm:flex-1 sm:shrink"
          >
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
  const meta = BOOKING_STATUS_META[booking.status];
  return (
    <Link href={`/bookings/${booking.id}`} className="block">
      <Card padding="sm" variant="interactive" className="flex flex-col gap-2">
        <span className="line-clamp-2 font-sans text-sm font-semibold text-content-primary lg:text-base">
          {booking.title ?? "Tattoo project"}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
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
/**
 * Thin data wrapper: owns the visible period (anchor date + week/month mode),
 * fetches the sessions covering that window, and hands them to the
 * presentational <SessionsCalendar>. Switching week↔month keeps the same
 * anchor date so the view stays put.
 */
function CalendarView({ artistId }: { artistId: string }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>("week");

  const range = useMemo(() => {
    const from = mode === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
    const to = mode === "week" ? endOfWeek(anchor) : endOfMonth(anchor);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [anchor, mode]);

  const sessionsQ = useArtistSessions(artistId, range);

  return (
    <SessionsCalendar
      mode={mode}
      anchor={anchor}
      sessions={sessionsQ.data ?? []}
      isLoading={sessionsQ.isLoading}
      onModeChange={setMode}
      onPrev={() =>
        setAnchor((d) => (mode === "week" ? addWeeks(d, -1) : addMonths(d, -1)))
      }
      onNext={() =>
        setAnchor((d) => (mode === "week" ? addWeeks(d, 1) : addMonths(d, 1)))
      }
    />
  );
}

