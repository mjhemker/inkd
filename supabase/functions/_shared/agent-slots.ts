// Booking-availability logic for the runtime, PORTED from
// packages/core/src/booking/slots.ts (edge functions are Deno and don't share
// the monorepo's module graph). Kept behaviourally identical to core so the
// Booking Manager proposes the same days the client-side intake calendar shows.
// If the core logic changes, mirror it here.
//
// Pure + dependency-free. Adds proposeSlots(): turn bookable days + a service
// duration into concrete { starts_at, ends_at } proposals for the agent.

export type BookingWindow = "1mo" | "2_3mo" | "4_6mo" | "1yr" | "closed";

export interface AvailabilityRuleLike {
  weekday: number; // 0 = Sunday
  start_time: string; // "HH:MM[:SS]"
  end_time: string;
  is_open: boolean;
}

export interface AvailabilityBlockLike {
  starts_at: string; // ISO timestamptz
  ends_at: string;
  is_available: boolean; // false = blocked
}

export interface DayWindow {
  start: string;
  end: string;
}

export interface BookableDay {
  date: string; // "YYYY-MM-DD"
  weekday: number;
  windows: DayWindow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function bookingWindowToDays(window: BookingWindow | null | undefined): number {
  switch (window) {
    case "1mo":
      return 30;
    case "2_3mo":
      return 90;
    case "4_6mo":
      return 180;
    case "1yr":
      return 365;
    case "closed":
      return 0;
    default:
      return 90;
  }
}

function toHHMM(time: string): string {
  return time.slice(0, 5);
}

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function mergeWindows(windows: DayWindow[]): DayWindow[] {
  const sorted = [...windows].sort((a, b) => a.start.localeCompare(b.start));
  const out: DayWindow[] = [];
  for (const next of sorted) {
    const last = out[out.length - 1];
    if (last && next.start <= last.end) {
      if (next.end > last.end) last.end = next.end;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}

function isDayBlocked(iso: string, blocks: AvailabilityBlockLike[]): boolean {
  const dayStart = startOfDayUTC(iso).getTime();
  const dayEnd = dayStart + DAY_MS;
  return blocks.some((b) => {
    if (b.is_available) return false;
    const bs = new Date(b.starts_at).getTime();
    const be = new Date(b.ends_at).getTime();
    return bs < dayEnd && be > dayStart;
  });
}

export interface ComputeBookableDatesInput {
  rules: AvailabilityRuleLike[];
  blocks?: AvailabilityBlockLike[];
  bookingWindow?: BookingWindow | null;
  minNoticeHours?: number | null;
  now?: Date;
  maxDays?: number;
}

/** Project recurring rules + blocks into concrete bookable days (UTC-anchored,
 * matching core's day-granular intake semantics). */
export function computeBookableDates(input: ComputeBookableDatesInput): BookableDay[] {
  const {
    rules,
    blocks = [],
    bookingWindow = "2_3mo",
    minNoticeHours = 0,
    now = new Date(),
    maxDays = 120,
  } = input;

  const windowDays = bookingWindowToDays(bookingWindow);
  if (windowDays === 0) return [];

  const byWeekday = new Map<number, DayWindow[]>();
  for (const rule of rules) {
    if (!rule.is_open) continue;
    const list = byWeekday.get(rule.weekday) ?? [];
    list.push({ start: toHHMM(rule.start_time), end: toHHMM(rule.end_time) });
    byWeekday.set(rule.weekday, list);
  }

  const noticeDays = Math.ceil(Math.max(0, minNoticeHours ?? 0) / 24);
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  first.setUTCDate(first.getUTCDate() + noticeDays);

  const span = Math.min(windowDays, maxDays);
  const out: BookableDay[] = [];
  for (let i = 0; i <= span; i++) {
    const d = new Date(first.getTime() + i * DAY_MS);
    const iso = toISODate(d);
    const weekday = d.getUTCDay();
    const raw = byWeekday.get(weekday);
    if (!raw || raw.length === 0) continue;
    if (isDayBlocked(iso, blocks)) continue;
    out.push({ date: iso, weekday, windows: mergeWindows(raw) });
  }
  return out;
}

export interface ProposedSlotLike {
  starts_at: string;
  ends_at: string;
}

/** "HH:MM" -> minutes since midnight. */
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** ISO timestamp (UTC) for a date + minutes-since-midnight. */
function slotISO(dateISO: string, minutes: number): string {
  const base = startOfDayUTC(dateISO).getTime();
  return new Date(base + minutes * 60_000).toISOString();
}

export interface ProposeSlotsInput {
  days: BookableDay[];
  durationMinutes: number;
  /** How many proposals to return (default 3). */
  count?: number;
  /** Take at most this many slots from any single day (default 1) so proposals
   *  spread across dates rather than stacking on the first open day. */
  maxPerDay?: number;
}

/**
 * Turn bookable days into concrete proposals: the earliest slot in each day's
 * first window that fits the service duration, spread across days. Deterministic
 * (no randomness) so the Booking Manager's proposals are reproducible + testable.
 */
export function proposeSlots(input: ProposeSlotsInput): ProposedSlotLike[] {
  const { days, durationMinutes, count = 3, maxPerDay = 1 } = input;
  const dur = Math.max(15, durationMinutes || 60);
  const out: ProposedSlotLike[] = [];
  for (const day of days) {
    let takenToday = 0;
    for (const w of day.windows) {
      if (takenToday >= maxPerDay) break;
      const startMin = hhmmToMinutes(w.start);
      const endMin = hhmmToMinutes(w.end);
      if (endMin - startMin < dur) continue;
      out.push({
        starts_at: slotISO(day.date, startMin),
        ends_at: slotISO(day.date, startMin + dur),
      });
      takenToday++;
      if (out.length >= count) return out;
    }
  }
  return out;
}
