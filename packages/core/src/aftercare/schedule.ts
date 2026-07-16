/**
 * Aftercare healing-timeline schedule + copy (pure, platform-neutral).
 *
 * Founder cadence: check-ins at 3 DAYS, 1 WEEK, 3 WEEKS after a session
 * completes — deliberately NOT 1/3/7. These offsets MUST stay in lockstep with:
 *   - the DB trigger `schedule_aftercare_on_session_complete()`
 *     (supabase/migrations/20260717090000_aftercare.sql), and
 *   - the edge-function due-finder (supabase/functions/_shared/aftercare-scheduled.ts).
 *
 * No DB, no I/O — safe under `node --test` type-stripping.
 */

export type AftercareKind = "day_3" | "week_1" | "week_3";

export const AFTERCARE_KINDS: readonly AftercareKind[] = ["day_3", "week_1", "week_3"];

/** Days after completion each check-in is scheduled for. 3 / 7 / 21. */
export const AFTERCARE_OFFSET_DAYS: Readonly<Record<AftercareKind, number>> = {
  day_3: 3,
  week_1: 7,
  week_3: 21,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Short human label for a check-in kind ("3 days", "1 week", "3 weeks"). */
export function aftercareKindLabel(kind: AftercareKind): string {
  switch (kind) {
    case "day_3":
      return "3 days";
    case "week_1":
      return "1 week";
    case "week_3":
      return "3 weeks";
  }
}

export interface ScheduledCheckin {
  kind: AftercareKind;
  /** ISO 8601, UTC. */
  scheduledFor: string;
}

/**
 * The three check-ins a completed session generates, at +3d / +7d / +21d from
 * `completedAt`. Mirrors the DB trigger exactly; the trigger is the real writer
 * (this function backs the unit test + any app-side preview).
 */
export function generateAftercareSchedule(completedAt: Date | string): ScheduledCheckin[] {
  const base = typeof completedAt === "string" ? new Date(completedAt) : completedAt;
  const baseMs = base.getTime();
  return AFTERCARE_KINDS.map((kind) => ({
    kind,
    scheduledFor: new Date(baseMs + AFTERCARE_OFFSET_DAYS[kind] * DAY_MS).toISOString(),
  }));
}

/** A pending check-in is "due" once its scheduled time has passed. */
export function isCheckinDue(scheduledFor: string, now: Date): boolean {
  return new Date(scheduledFor).getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Warm, informative check-in copy. Grounded in the tattoo label + artist name
// so the message reads like the artist wrote it ("How's your poppy cluster
// healing? Tap to share a photo with Jayden").
// ---------------------------------------------------------------------------

export interface TattooLabelParts {
  bookingTitle?: string | null;
  serviceName?: string | null;
  placement?: string | null;
}

/** Best available human label for the piece; falls back to "your new ink". */
export function aftercareTattooLabel(parts: TattooLabelParts): string {
  const pick = (s?: string | null) => (s && s.trim() ? s.trim() : null);
  return pick(parts.bookingTitle) ?? pick(parts.serviceName) ?? pick(parts.placement) ?? "your new ink";
}

export interface AftercareMessage {
  title: string;
  body: string;
}

/** The client-facing check-in notification copy for a given kind. */
export function buildAftercareCheckinMessage(
  kind: AftercareKind,
  tattooLabel: string,
  artistFirstName: string,
): AftercareMessage {
  const artist = artistFirstName.trim() || "your artist";
  const label = tattooLabel.trim() || "your new ink";
  switch (kind) {
    case "day_3":
      return {
        title: "How's it healing?",
        body: `It's been a few days since ${label}. How's it feeling? Tap to log how it's healing and share a photo with ${artist}.`,
      };
    case "week_1":
      return {
        title: "One week in",
        body: `${capitalize(label)} is a week old — the peeling stage. Tap to tell ${artist} how it's healing and add a photo.`,
      };
    case "week_3":
      return {
        title: "Nearly healed",
        body: `Three weeks on, ${label} should be settling in nicely. Tap to share a healed photo with ${artist} and leave a review.`,
      };
  }
}

/** Prefilled, editable message an artist can send to offer a touch-up/rebook
 * off the back of a healing check-in (used by the artist healing view's
 * one-tap "request touch-up"). */
export function buildTouchUpMessage(tattooLabel: string): string {
  const label = tattooLabel.trim() || "your tattoo";
  return (
    `Hey! Saw your healing update on ${label} — it's looking great. If you'd ever ` +
    `like a touch-up or want to build on it, just let me know and I'll get you on the books.`
  );
}

/** First name from a display name (for the warm, personal tone). */
export function firstName(displayName: string | null | undefined): string {
  const n = (displayName ?? "").trim();
  if (!n) return "your artist";
  return n.split(/\s+/)[0] ?? "your artist";
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
