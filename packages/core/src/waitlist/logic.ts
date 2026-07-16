/**
 * Pure waitlist logic — the matching, cascade-ordering, offer-expiry, and
 * double-booking predicates, extracted so they are unit-testable offline and so
 * the client and the SQL (migration 20260717130000_waitlist.sql) agree by
 * construction. Nothing here does IO. The SQL functions
 * (`waitlist_match_next`, `waitlist_create_offer`, `waitlist_cascade`,
 * `claim_waitlist_offer`) are the runtime source of truth; this mirrors them.
 */

/** The pilot is Baltimore + Philadelphia; slot wall-time is evaluated in ET,
 * exactly like the SQL (`... at time zone 'America/New_York'`). */
export const WAITLIST_TZ = "America/New_York";

/** Offer time-to-live: 3 hours, capped at the slot start (SQL `least(...)`). */
export const WAITLIST_OFFER_TTL_MS = 3 * 60 * 60 * 1000;

/** Fallback slot length when a freed slot has no explicit end (SQL uses 60m). */
export const WAITLIST_DEFAULT_SLOT_MINUTES = 60;

export interface WaitlistSlot {
  artistId: string;
  serviceId?: string | null;
  slotStart: Date;
  slotEnd?: Date | null;
}

export interface MatchableEntry {
  id: string;
  artistId: string;
  status: string;
  serviceId?: string | null;
  /** ISO date strings "YYYY-MM-DD" (or null = open-ended). */
  earliestDate?: string | null;
  latestDate?: string | null;
  /** 0=Sun .. 6=Sat; null/empty = any weekday. */
  preferredWeekdays?: number[] | null;
  /** "HH:MM" 24h (or null = any). */
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  priority: number;
  /** ISO timestamp; FIFO tie-break. */
  createdAt: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface SlotWallTime {
  /** "YYYY-MM-DD" in the target zone. */
  date: string;
  /** 0=Sun..6=Sat in the target zone. */
  weekday: number;
  /** minutes since local midnight (0..1439). */
  minutesOfDay: number;
}

/** Resolve a slot's local wall-clock parts in the given IANA zone. */
export function slotWallTime(slotStart: Date, timeZone: string = WAITLIST_TZ): SlotWallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(slotStart);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // en-US hour12:false can emit "24" at midnight
  const minute = parseInt(get("minute"), 10);
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":");
  return parseInt(h ?? "0", 10) * 60 + parseInt(m ?? "0", 10);
}

/**
 * Does a freed slot satisfy one entry's desired window? Mirrors the SQL
 * `waitlist_match_next` predicate exactly (service, date range, weekday, and
 * time-of-day band; all criteria are AND, each null criterion = "any").
 * NOTE: does NOT check entry.status — callers filter for 'active'.
 */
export function matchesWindow(
  entry: MatchableEntry,
  slot: WaitlistSlot,
  timeZone: string = WAITLIST_TZ,
): boolean {
  if (entry.artistId !== slot.artistId) return false;

  // A service-specific entry only matches an opening of that same service.
  if (entry.serviceId != null && entry.serviceId !== (slot.serviceId ?? null)) {
    return false;
  }

  const wt = slotWallTime(slot.slotStart, timeZone);

  if (entry.earliestDate && wt.date < entry.earliestDate) return false;
  if (entry.latestDate && wt.date > entry.latestDate) return false;

  const days = entry.preferredWeekdays;
  if (days && days.length > 0 && !days.includes(wt.weekday)) return false;

  if (entry.preferredTimeStart && wt.minutesOfDay < hhmmToMinutes(entry.preferredTimeStart)) {
    return false;
  }
  if (entry.preferredTimeEnd && wt.minutesOfDay >= hhmmToMinutes(entry.preferredTimeEnd)) {
    return false;
  }
  return true;
}

/**
 * Choose the next candidate for an opening: the highest-priority ACTIVE entry
 * that matches the slot and has not already been offered THIS opening; ties
 * break FIFO by created_at. Returns null when the opening is exhausted. Mirrors
 * `waitlist_match_next` + the cascade's "never re-offer the same opening".
 */
export function pickNextCandidate(
  entries: MatchableEntry[],
  alreadyOfferedEntryIds: Iterable<string>,
  slot: WaitlistSlot,
  timeZone: string = WAITLIST_TZ,
): MatchableEntry | null {
  const seen = new Set(alreadyOfferedEntryIds);
  const eligible = entries.filter(
    (e) => e.status === "active" && !seen.has(e.id) && matchesWindow(e, slot, timeZone),
  );
  eligible.sort((a, b) =>
    b.priority - a.priority || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
  );
  return eligible[0] ?? null;
}

/**
 * Offer expiry = min(now + TTL, slotStart). Returns null when the slot is too
 * imminent to offer (expiry would be at/behind now) — the SQL skips the offer
 * in that case. Mirrors `waitlist_create_offer`'s `least(...)` + guard.
 */
export function computeOfferExpiry(
  now: Date,
  slotStart: Date,
  ttlMs: number = WAITLIST_OFFER_TTL_MS,
): Date | null {
  const capped = Math.min(now.getTime() + ttlMs, slotStart.getTime());
  return capped <= now.getTime() ? null : new Date(capped);
}

export function isOfferExpired(
  offer: { status: string; expiresAt: string | Date },
  now: Date,
): boolean {
  if (offer.status !== "pending") return offer.status === "expired";
  const exp = offer.expiresAt instanceof Date ? offer.expiresAt : new Date(offer.expiresAt);
  return exp.getTime() <= now.getTime();
}

/** Millisecond countdown remaining on a pending offer (0 once expired). */
export function offerCountdownMs(expiresAt: string | Date, now: Date): number {
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Math.max(0, exp.getTime() - now.getTime());
}

/** Half-open interval overlap: [aS,aE) ∩ [bS,bE) ≠ ∅. */
export function slotsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export interface LiveSession {
  status: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
}

export type ClaimCheck =
  | { ok: true }
  | { ok: false; reason: "not_pending" | "expired" | "slot_taken" };

/**
 * The double-booking guard, as a pure predicate (mirrors the checks inside
 * `claim_waitlist_offer`, which additionally holds an advisory lock on
 * (artist, slot) so this evaluates race-free at runtime): an offer is claimable
 * only if it is still pending, unexpired, and NO live session (scheduled |
 * confirmed) overlaps the slot for the artist.
 */
export function canClaimOffer(
  offer: { status: string; expiresAt: string | Date; slotStart: Date; slotEnd?: Date | null },
  liveSessions: LiveSession[],
  now: Date,
): ClaimCheck {
  if (offer.status !== "pending") return { ok: false, reason: "not_pending" };
  if (isOfferExpired({ status: "pending", expiresAt: offer.expiresAt }, now)) {
    return { ok: false, reason: "expired" };
  }
  const start = offer.slotStart;
  const end =
    offer.slotEnd ?? new Date(start.getTime() + WAITLIST_DEFAULT_SLOT_MINUTES * 60_000);
  const conflict = liveSessions.some((s) => {
    if (s.status !== "scheduled" && s.status !== "confirmed") return false;
    if (!s.scheduledStart) return false;
    const sEnd =
      s.scheduledEnd ??
      new Date(s.scheduledStart.getTime() + WAITLIST_DEFAULT_SLOT_MINUTES * 60_000);
    return slotsOverlap(start, end, s.scheduledStart, sEnd);
  });
  return conflict ? { ok: false, reason: "slot_taken" } : { ok: true };
}
