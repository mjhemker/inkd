/**
 * Small, dependency-free date-window helpers for calendar surfaces (artist
 * bookings week/month views). Everything works on local time — the calendar is
 * an artist's own studio schedule, so "the week of July 12" means their local
 * week, not a UTC one. Sunday-first weeks to match the month grid header (S M
 * T W T F S).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight (local) at the start of `date`'s day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last millisecond (local) of `date`'s day. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** True if both dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Sunday-first start-of-week midnight for the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Saturday-night end-of-week for the week containing `date`. */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return endOfDay(end);
}

/** First-of-month midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Last-of-month end-of-day. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Shift by whole weeks (negative = back). */
export function addWeeks(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * DAY_MS);
}

/** Shift by whole months, preserving day-of-month where possible. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonthDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Clamp to the last day of the destination month (e.g. Jan 31 → Feb 28).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetMonthDay, lastDay));
  return d;
}

/** The 7 day-midnights of the week containing `date` (Sun → Sat). */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Human range label for a week, collapsing shared month/year:
 *   "July 12 – 18, 2026"   (same month)
 *   "June 29 – July 5, 2026" (crosses a month)
 *   "Dec 28, 2025 – Jan 3, 2026" (crosses a year)
 */
export function weekRangeLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    const month = start.toLocaleDateString("en-US", { month: "long" });
    return `${month} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    const startLabel = start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const endLabel = end.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
  }
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

/** "July 2026" — month + year label. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
