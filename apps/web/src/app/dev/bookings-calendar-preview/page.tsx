"use client";

/**
 * Dev-only preview harness for the artist BOOKINGS calendar + pipeline board.
 * Renders the REAL presentational `SessionsCalendar` and `PipelineBoard`
 * against seeded, offline data (no Supabase) so the week grid, month grid,
 * header navigation and full-width pipeline can be built and screenshotted in
 * isolation. Never linked from product nav. Not for production use.
 */
import { useMemo, useState } from "react";
import { PipelineBoard } from "@/components/bookings/artist-bookings";
import {
  SessionsCalendar,
  type CalendarMode,
} from "@/components/bookings/sessions-calendar";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
} from "@inkd/core";
import { calendarSessions, pipelineBookings } from "./seed";

export default function BookingsCalendarPreviewPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>("week");

  const allSessions = useMemo(() => calendarSessions(), []);
  const bookings = useMemo(() => pipelineBookings(), []);

  // Mirror the live wrapper: scope the seeded sessions to the visible window.
  const sessions = useMemo(() => {
    const from = mode === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
    const to = mode === "week" ? endOfWeek(anchor) : endOfMonth(anchor);
    return allSessions.filter((s) => {
      if (!s.scheduled_start) return false;
      const t = new Date(s.scheduled_start).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
  }, [allSessions, anchor, mode]);

  return (
    <div className="min-h-dvh bg-surface-base">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <header className="mb-8 flex flex-col gap-2">
          <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Internal · not for production
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Bookings — calendar & pipeline
          </h1>
          <p className="max-w-2xl text-content-secondary">
            The artist Bookings calendar (real week grid + month grid with exact
            header navigation) and the full-width pipeline board, against seeded
            offline data. Seed includes an overlapping session pair and a
            multi-day week.
          </p>
        </header>

        <section className="mb-12 flex flex-col gap-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Sessions calendar
          </h2>
          <SessionsCalendar
            mode={mode}
            anchor={anchor}
            sessions={sessions}
            onModeChange={setMode}
            onPrev={() =>
              setAnchor((d) =>
                mode === "week" ? addWeeks(d, -1) : addMonths(d, -1),
              )
            }
            onNext={() =>
              setAnchor((d) =>
                mode === "week" ? addWeeks(d, 1) : addMonths(d, 1),
              )
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Pipeline board
          </h2>
          <PipelineBoard bookings={bookings} loading={false} />
        </section>
      </div>
    </div>
  );
}
