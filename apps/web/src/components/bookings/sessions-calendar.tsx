"use client";

/**
 * Presentational sessions calendar for the artist bookings surface (web).
 *
 * Fully controlled: the parent owns the `anchor` date + `mode` and the session
 * data (fetched live in `artist-bookings.tsx`, seeded in the dev harness). This
 * component just draws:
 *   - a header with the exact period label ("July 12 – 18, 2026" / "July 2026")
 *     and ‹ › navigation + a week/month toggle,
 *   - a real week GRID (X = 7 days, Y = hours) with positioned session placards,
 *     graceful overlap columns, a highlighted "today" column and a now-line,
 *   - a month grid (calendar cells with session chips).
 */
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  SESSION_STATUS_META,
  isSameDay,
  monthLabel,
  weekDays,
  weekRangeLabel,
  type Session,
  type StatusTone,
} from "@inkd/core";
import { Button, Icon, Tabs } from "@inkd/ui/web";
import { formatTime } from "./shared";

export type CalendarMode = "week" | "month";

/** Status tone → legend dot / chip color. */
const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-neutral-500",
  brand: "bg-brand",
  info: "bg-info-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

/** Status tone → week-grid placard fill + left accent bar. */
const TONE_BLOCK: Record<StatusTone, string> = {
  neutral: "bg-neutral-500/20 border-l-neutral-400 text-content-secondary",
  brand: "bg-brand/20 border-l-brand text-content-primary",
  info: "bg-info-500/20 border-l-info-500 text-content-primary",
  success: "bg-success-500/20 border-l-success-500 text-content-primary",
  warning: "bg-warning-500/20 border-l-warning-500 text-content-primary",
  danger: "bg-danger-500/20 border-l-danger-500 text-content-primary",
};

const HOUR_HEIGHT = 52; // px per hour row
const DAY_START_HOUR = 7; // default top of the visible scroll window
const MIN_BLOCK_HEIGHT = 24; // keep very short sessions legible/clickable
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function sessionHref(session: Session): string {
  return `/bookings/${session.booking_id}`;
}

// --- Public component -------------------------------------------------------
export function SessionsCalendar({
  mode,
  anchor,
  sessions,
  isLoading,
  onPrev,
  onNext,
  onModeChange,
}: {
  mode: CalendarMode;
  anchor: Date;
  sessions: Session[];
  isLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onModeChange: (mode: CalendarMode) => void;
}) {
  const label = mode === "week" ? weekRangeLabel(anchor) : monthLabel(anchor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={mode === "week" ? "Previous week" : "Previous month"}
            onClick={onPrev}
          >
            <Icon name="chevron-left" size={18} />
          </Button>
          <span className="min-w-52 text-center font-display text-lg font-bold tracking-tight sm:text-xl">
            {label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={mode === "week" ? "Next week" : "Next month"}
            onClick={onNext}
          >
            <Icon name="chevron-right" size={18} />
          </Button>
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as CalendarMode)}
          items={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-content-muted">
        {(["scheduled", "confirmed", "completed", "cancelled"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TONE_DOT[SESSION_STATUS_META[s].tone]}`} />
            {SESSION_STATUS_META[s].label}
          </span>
        ))}
      </div>

      {mode === "week" ? (
        <WeekGrid anchor={anchor} sessions={sessions} />
      ) : (
        <MonthGrid anchor={anchor} sessions={sessions} />
      )}

      {!isLoading && sessions.length === 0 && (
        <p className="text-center text-sm text-content-muted">
          {mode === "week"
            ? "No sessions scheduled this week."
            : "No sessions scheduled this month."}
        </p>
      )}
    </div>
  );
}

// --- Week grid --------------------------------------------------------------
interface LaidOutSession {
  session: Session;
  top: number;
  height: number;
  col: number;
  colCount: number;
}

/**
 * Assign overlapping sessions in a single day to side-by-side columns (greedy
 * interval graph coloring): each cluster of transitively-overlapping sessions
 * shares its width evenly so nothing is hidden behind another block.
 */
function layoutDaySessions(daySessions: Session[]): LaidOutSession[] {
  const events = daySessions
    .map((session) => {
      const start = new Date(session.scheduled_start as string);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const end = session.scheduled_end
        ? new Date(session.scheduled_end)
        : new Date(start.getTime() + (session.duration_minutes ?? 60) * 60_000);
      // Clamp the end to end-of-day so a late session doesn't overflow the grid.
      let endMin = end.getHours() * 60 + end.getMinutes();
      if (!isSameDay(start, end) || endMin <= startMin) endMin = 24 * 60;
      return { session, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: LaidOutSession[] = [];
  let cluster: (typeof events)[number][] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = []; // last endMin occupying each column
    const placed: { ev: (typeof events)[number]; col: number }[] = [];
    for (const ev of cluster) {
      let col = colEnds.findIndex((e) => e <= ev.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(ev.endMin);
      } else {
        colEnds[col] = ev.endMin;
      }
      placed.push({ ev, col });
    }
    const colCount = colEnds.length;
    for (const { ev, col } of placed) {
      const top = (ev.startMin / 60) * HOUR_HEIGHT;
      const rawHeight = ((ev.endMin - ev.startMin) / 60) * HOUR_HEIGHT;
      result.push({
        session: ev.session,
        top,
        height: Math.max(rawHeight, MIN_BLOCK_HEIGHT),
        col,
        colCount,
      });
    }
    cluster = [];
  };

  for (const ev of events) {
    if (cluster.length && ev.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  if (cluster.length) flush();
  return result;
}

function WeekGrid({ anchor, sessions }: { anchor: Date; sessions: Session[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const now = new Date();

  const perDay = useMemo(() => {
    return days.map((day) =>
      layoutDaySessions(
        sessions.filter(
          (s) => s.scheduled_start && isSameDay(new Date(s.scheduled_start), day),
        ),
      ),
    );
  }, [days, sessions]);

  // Open scrolled to the working day (07:00) with the full day still reachable.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DAY_START_HOUR * HOUR_HEIGHT;
    }
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
      {/* Day header row (aligned over the hour gutter). */}
      <div className="flex border-b border-border-subtle bg-surface-raised">
        <div className="w-12 shrink-0 border-r border-border-subtle sm:w-14" />
        {days.map((day) => {
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={
                "flex flex-1 flex-col items-center gap-0.5 py-2 " +
                (today ? "bg-brand/10" : "")
              }
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={
                  "grid h-6 w-6 place-items-center rounded-full text-sm font-bold " +
                  (today ? "bg-brand text-brand-on" : "text-content-primary")
                }
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid. */}
      <div
        ref={scrollRef}
        className="max-h-[560px] overflow-y-auto"
        aria-label="Week schedule grid"
      >
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour gutter */}
          <div className="w-12 shrink-0 border-r border-border-subtle sm:w-14">
            {HOURS.map((h) => (
              <div
                key={h}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-1.5 font-mono text-[10px] text-content-muted">
                  {h === 0 ? "" : hourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const today = isSameDay(day, now);
            return (
              <div
                key={day.toISOString()}
                className={
                  "relative flex-1 border-r border-border-subtle last:border-r-0 " +
                  (today ? "bg-brand/[0.06]" : "")
                }
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-border-subtle/60"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Now indicator */}
                {today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  >
                    <span className="h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-danger-500" />
                    <span className="h-px flex-1 bg-danger-500/70" />
                  </div>
                )}

                {/* Session placards */}
                {(perDay[dayIdx] ?? []).map((laid) => (
                  <SessionBlock key={laid.session.id} laid={laid} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SessionBlock({ laid }: { laid: LaidOutSession }) {
  const { session, top, height, col, colCount } = laid;
  const meta = SESSION_STATUS_META[session.status];
  const widthPct = 100 / colCount;
  const gap = colCount > 1 ? 2 : 0; // px breathing room between shared columns
  const compact = height < 40;

  return (
    <Link
      href={sessionHref(session)}
      title={`${formatTime(session.scheduled_start)} · Session #${session.session_number} · ${meta.label}`}
      className={
        "group absolute z-10 flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand hover:shadow-md " +
        TONE_BLOCK[meta.tone]
      }
      style={{
        top: top + 1,
        height: height - 2,
        left: `calc(${col * widthPct}% + ${gap}px)`,
        width: `calc(${widthPct}% - ${gap * 2}px)`,
      }}
    >
      <span className="truncate font-mono text-[10px] leading-tight opacity-80">
        {formatTime(session.scheduled_start)}
      </span>
      {!compact && (
        <span className="truncate text-[11px] font-semibold leading-tight">
          Session #{session.session_number}
        </span>
      )}
    </Link>
  );
}

// --- Month grid -------------------------------------------------------------
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function MonthGrid({ anchor, sessions }: { anchor: Date; sessions: Session[] }) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const now = new Date();

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!s.scheduled_start) continue;
      const key = new Date(s.scheduled_start).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduled_start as string).getTime() -
          new Date(b.scheduled_start as string).getTime(),
      );
    }
    return map;
  }, [sessions]);

  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

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
            return (
              <div
                key={i}
                className="min-h-24 border-b border-r border-border-subtle bg-surface-base/40"
              />
            );
          const cellDate = new Date(year, month, day);
          const key = cellDate.toDateString();
          const daySessions = byDay.get(key) ?? [];
          const isToday = isSameDay(cellDate, now);
          return (
            <div
              key={i}
              className={
                "min-h-24 border-b border-r border-border-subtle p-1.5 " +
                (isToday ? "bg-brand/[0.06]" : "")
              }
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
                {daySessions.slice(0, 3).map((s) => (
                  <SessionChip key={s.id} session={s} />
                ))}
                {daySessions.length > 3 && (
                  <span className="pl-1 text-[10px] text-content-muted">
                    +{daySessions.length - 3} more
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

function SessionChip({ session }: { session: Session }) {
  const meta = SESSION_STATUS_META[session.status];
  return (
    <Link
      href={sessionHref(session)}
      className="flex items-center gap-1.5 truncate rounded bg-surface-overlay/70 px-1.5 py-0.5 text-[11px] text-content-secondary outline-none hover:bg-surface-overlay focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} />
      <span className="truncate">{formatTime(session.scheduled_start)}</span>
    </Link>
  );
}
