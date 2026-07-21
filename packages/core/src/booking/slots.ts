/**
 * Pure booking-availability logic — no I/O, no platform deps. Turns an artist's
 * weekly `availability_rules` + `availability_blocks` + `booking_policies` into
 * a concrete list of bookable days the client can pick from during intake.
 *
 * Kept dependency-free (no date library) so it runs identically on web and RN.
 * All dates are handled as calendar days in the viewer's local time — good
 * enough for "pick a preferred day" intake; exact slot holds happen later,
 * artist-side, against the real calendar.
 */
import type {
  AvailabilityRule,
  AvailabilityBlock,
  BookingWindow,
} from "../types/rows";

/** A single open window within a day, as "HH:MM" strings. */
export interface DayWindow {
  start: string;
  end: string;
}

/** One selectable day in the intake calendar. */
export interface BookableDay {
  /** ISO calendar date, "YYYY-MM-DD". */
  date: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Merged open windows for the day (empty when the artist isn't open). */
  windows: DayWindow[];
  /** True when the day has at least one open window and no full block. */
  bookable: boolean;
}

/** The client's chosen preferred date/time, persisted on booking_requests. */
export interface PreferredDate {
  date: string;
  start?: string;
  end?: string;
  label?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days ahead a booking window opens the calendar. `closed` → 0. */
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

/** Coarse time-of-day preference offered in the no-openings fallback picker. */
export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Concrete window each time-of-day band maps to (local "HH:MM"). */
export const TIME_OF_DAY_WINDOWS: Record<TimeOfDay, DayWindow> = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "21:00" },
};

/** A plain selectable calendar day for the no-openings fallback (no windows). */
export interface PreferredDayOption {
  /** ISO calendar date, "YYYY-MM-DD". */
  date: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

export interface PreferredDayOptionsInput {
  bookingWindow?: BookingWindow | null;
  minNoticeHours?: number | null;
  /** Anchor "now"; defaults to the current time. Injectable for tests. */
  now?: Date;
  /** How many days to offer (default 60), capped to the booking-window horizon. */
  span?: number;
}

/**
 * Fallback day options for the intake calendar when an artist has published NO
 * concrete openings but is still taking requests: a straight run of the next
 * `span` calendar days (default 60), starting the day after today (plus any
 * min-notice), capped to the artist's booking-window horizon. Lets a client
 * genuinely express preferred days instead of hitting a dead end. Pure +
 * dependency-free so web and RN behave identically. Returns [] only when the
 * booking window is `closed`.
 */
export function computePreferredDayOptions(
  input: PreferredDayOptionsInput = {},
): PreferredDayOption[] {
  const {
    bookingWindow = "2_3mo",
    minNoticeHours = 0,
    now = new Date(),
    span = 60,
  } = input;

  const windowDays = bookingWindowToDays(bookingWindow);
  if (windowDays === 0) return [];

  const noticeDays = Math.ceil(Math.max(0, minNoticeHours ?? 0) / 24);
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  // Never today: offer from tomorrow at the earliest, plus any min-notice.
  start.setDate(start.getDate() + Math.max(1, noticeDays));

  const count = Math.min(Math.max(0, Math.floor(span)), windowDays);
  const out: PreferredDayOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    out.push({ date: toISODate(d), weekday: d.getDay() });
  }
  return out;
}

/**
 * Build a `PreferredDate` for a fallback day plus an optional time-of-day band.
 * With no band it's a bare date; with one it carries the band's window + label.
 */
export function preferredDateFromOption(
  date: string,
  timeOfDay?: TimeOfDay | null,
): PreferredDate {
  if (!timeOfDay) return { date };
  const band = TIME_OF_DAY_WINDOWS[timeOfDay];
  return { date, start: band.start, end: band.end, label: timeOfDay };
}

/** Normalize a "HH:MM[:SS]" time to "HH:MM". */
function toHHMM(time: string): string {
  return time.slice(0, 5);
}

/** "YYYY-MM-DD" for a Date, in local time. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Midnight (local) at the start of an ISO date string. */
function startOfDay(iso: string): Date {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Merge overlapping/adjacent windows so a day shows clean, contiguous hours. */
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

/** True when a blocking (is_available=false) block covers the whole calendar day. */
function isDayBlocked(iso: string, blocks: AvailabilityBlock[]): boolean {
  const dayStart = startOfDay(iso).getTime();
  const dayEnd = dayStart + DAY_MS;
  return blocks.some((b) => {
    if (b.is_available) return false; // extra-open blocks never remove a day
    const bs = new Date(b.starts_at).getTime();
    const be = new Date(b.ends_at).getTime();
    // Overlaps any part of the day. (Intake is day-granular, so any overlap hides it.)
    return bs < dayEnd && be > dayStart;
  });
}

export interface ComputeBookableDatesInput {
  rules: AvailabilityRule[];
  blocks?: AvailabilityBlock[];
  bookingWindow?: BookingWindow | null;
  minNoticeHours?: number | null;
  /** Anchor "now"; defaults to the current time. Injectable for tests. */
  now?: Date;
  /** Hard cap on how many days to project (keeps the calendar light). */
  maxDays?: number;
}

/**
 * Project the artist's recurring rules + blocks into concrete bookable days,
 * from the earliest allowed day (respecting min-notice) through the booking
 * window. Returns only bookable days, in chronological order.
 */
export function computeBookableDates(
  input: ComputeBookableDatesInput,
): BookableDay[] {
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

  // Open windows per weekday, from the rules.
  const byWeekday = new Map<number, DayWindow[]>();
  for (const rule of rules) {
    if (!rule.is_open) continue;
    const list = byWeekday.get(rule.weekday) ?? [];
    list.push({ start: toHHMM(rule.start_time), end: toHHMM(rule.end_time) });
    byWeekday.set(rule.weekday, list);
  }

  // Earliest bookable day = today + ceil(minNotice / 24h).
  const noticeDays = Math.ceil(Math.max(0, minNoticeHours ?? 0) / 24);
  const firstDay = new Date(now.getTime());
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() + noticeDays);

  const span = Math.min(windowDays, maxDays);
  const out: BookableDay[] = [];
  for (let i = 0; i <= span; i++) {
    const d = new Date(firstDay.getTime() + i * DAY_MS);
    const iso = toISODate(d);
    const weekday = d.getDay();
    const raw = byWeekday.get(weekday);
    if (!raw || raw.length === 0) continue;
    if (isDayBlocked(iso, blocks)) continue;
    out.push({
      date: iso,
      weekday,
      windows: mergeWindows(raw),
      bookable: true,
    });
  }
  return out;
}

/** Group bookable days by "YYYY-MM" for a month-grid renderer. */
export function groupBookableByMonth(
  days: BookableDay[],
): { month: string; days: BookableDay[] }[] {
  const map = new Map<string, BookableDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(day);
    map.set(key, list);
  }
  return [...map.entries()].map(([month, ds]) => ({ month, days: ds }));
}
