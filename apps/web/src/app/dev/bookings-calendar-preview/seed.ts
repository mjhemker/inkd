/**
 * Seeded, offline data for the bookings calendar + pipeline dev harness.
 *
 * Sessions are anchored to the CURRENT local week (Sun-first) so the week grid
 * renders populated with a highlighted "today" and a now-line, and the month
 * view shows this week's sessions in place. The shape deliberately includes:
 *   - an OVERLAPPING PAIR on one day (to exercise side-by-side column layout),
 *   - a MULTI-DAY spread across the week (Mon → Sat),
 *   - every session status tone (scheduled / confirmed / completed / cancelled).
 *
 * Never imported outside /dev/*.
 */
import { startOfWeek, type Booking, type Session } from "@inkd/core";

const ARTIST = "artist-demo";
const CLIENT = "client-demo";

function at(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base);
  d.setDate(base.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function session(
  partial: Pick<Session, "id" | "booking_id" | "status" | "session_number"> & {
    start: string;
    end: string;
  },
): Session {
  return {
    id: partial.id,
    artist_id: ARTIST,
    client_id: CLIENT,
    booking_id: partial.booking_id,
    session_number: partial.session_number,
    status: partial.status,
    scheduled_start: partial.start,
    scheduled_end: partial.end,
    duration_minutes: Math.round(
      (new Date(partial.end).getTime() - new Date(partial.start).getTime()) /
        60_000,
    ),
    location_id: null,
    notes: null,
    deposit_cents: 15_000,
    deposit_paid: true,
    balance_cents: 40_000,
    balance_paid: false,
    created_at: partial.start,
    updated_at: partial.start,
  };
}

/** Seed sessions for the visible calendar (this week). */
export function calendarSessions(now: Date = new Date()): Session[] {
  const wk = startOfWeek(now); // Sunday 00:00 of the current week

  return [
    // Monday — OVERLAPPING PAIR (10:00–12:00 alongside 11:00–13:00).
    session({ id: "s1", booking_id: "bk-3", status: "scheduled", session_number: 1, start: at(wk, 1, 10, 0), end: at(wk, 1, 12, 0) }),
    session({ id: "s2", booking_id: "bk-4", status: "confirmed", session_number: 1, start: at(wk, 1, 11, 0), end: at(wk, 1, 13, 0) }),
    // Tuesday — a single long afternoon session.
    session({ id: "s3", booking_id: "bk-6", status: "confirmed", session_number: 2, start: at(wk, 2, 14, 0), end: at(wk, 2, 17, 30) }),
    // Wednesday — an early completed session.
    session({ id: "s4", booking_id: "bk-8", status: "completed", session_number: 1, start: at(wk, 3, 9, 0), end: at(wk, 3, 10, 30) }),
    // Thursday — two back-to-back (touching, not overlapping).
    session({ id: "s5", booking_id: "bk-3", status: "scheduled", session_number: 2, start: at(wk, 4, 13, 0), end: at(wk, 4, 15, 0) }),
    session({ id: "s6", booking_id: "bk-5", status: "confirmed", session_number: 1, start: at(wk, 4, 15, 30), end: at(wk, 4, 18, 0) }),
    // Friday — an evening session.
    session({ id: "s7", booking_id: "bk-5", status: "confirmed", session_number: 2, start: at(wk, 5, 16, 0), end: at(wk, 5, 19, 0) }),
    // Saturday — a cancelled slot (neutral tone).
    session({ id: "s8", booking_id: "bk-9", status: "cancelled", session_number: 1, start: at(wk, 6, 12, 0), end: at(wk, 6, 13, 0) }),
  ];
}

function booking(
  id: string,
  status: Booking["status"],
  title: string,
  daysAgo: number,
): Booking {
  const updated = new Date();
  updated.setDate(updated.getDate() - daysAgo);
  return {
    id,
    artist_id: ARTIST,
    client_id: CLIENT,
    request_id: null,
    service_id: null,
    status,
    title,
    notes: null,
    deposit_cents: 15_000,
    total_price_cents: 55_000,
    created_at: updated.toISOString(),
    updated_at: updated.toISOString(),
  };
}

/** Seed bookings spread across pipeline stages for the board. */
export function pipelineBookings(): Booking[] {
  return [
    booking("bk-1", "pending", "Neo-trad snake — half sleeve", 1),
    booking("bk-2", "pending", "Fine-line botanical wrap", 2),
    booking("bk-3", "confirmed", "Blackwork mandala back piece", 3),
    booking("bk-4", "confirmed", "Watercolor koi — forearm", 4),
    booking("bk-5", "confirmed", "Script memorial — ribcage", 5),
    booking("bk-6", "in_progress", "Japanese dragon — full sleeve", 6),
    booking("bk-7", "in_progress", "Geometric wolf — thigh", 7),
    booking("bk-8", "completed", "Ornamental chest gap-filler", 10),
    booking("bk-9", "cancelled", "Traditional swallow pair", 12),
  ];
}
