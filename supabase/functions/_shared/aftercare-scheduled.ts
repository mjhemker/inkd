// Aftercare scheduled delivery — the due-finder + dispatch planner for the
// daily agent-scheduled tick. Fully DETERMINISTIC (no LLM, no ANTHROPIC key):
// given the due `aftercare_checkins` rows (status=pending, scheduled_for<=now)
// joined with their artist + booking context, it produces a plan the edge
// function executes — send a warm client-facing check-in notification, or skip
// when the artist has aftercare turned off.
//
// Founder cadence is 3d / 1w / 3w after completion (NOT 1/3/7) — the offsets
// live in the DB trigger + packages/core/src/aftercare/schedule.ts; here we
// only fan out the rows that trigger already scheduled.
//
// Pure + dependency-free (erasable TypeScript) so it runs under node --test and
// Deno identically. The deployed edge function (agent-scheduled/index.ts) backs
// the DB reads/writes; this file never imports a client.

export type AftercareKind = "day_3" | "week_1" | "week_3";

/** Offsets (days) each kind is scheduled at — mirrors the DB trigger + core. */
export const AFTERCARE_OFFSET_DAYS: Readonly<Record<AftercareKind, number>> = {
  day_3: 3,
  week_1: 7,
  week_3: 21,
};

/** The flattened due row (query joins resolved into scalars). */
export interface DueAftercareRowLike {
  id: string;
  kind: AftercareKind;
  status: string;
  scheduled_for: string;
  session_id: string;
  booking_id: string | null;
  client_id: string;
  artist_id: string;
  aftercare_enabled: boolean;
  artist_display_name: string | null;
  booking_title: string | null;
  service_name: string | null;
  has_review: boolean;
}

export interface AftercareMessage {
  title: string;
  body: string;
}

/** A single planned dispatch (or skip) for one due check-in. */
export interface AftercareDispatch {
  checkinId: string;
  kind: AftercareKind;
  clientId: string;
  artistId: string;
  bookingId: string | null;
  sessionId: string;
  /** Artist turned aftercare off after scheduling → mark skipped, send nothing. */
  disabled: boolean;
  tattooLabel: string;
  artistFirstName: string;
  /** week_3 && the client hasn't reviewed → include a review CTA + touch-up nudge. */
  nudgeReview: boolean;
  message: AftercareMessage;
  actionUrl: string;
}

// ---------------------------------------------------------------------------
// Copy helpers (self-contained so this module stays Deno/node-portable).
// ---------------------------------------------------------------------------

export function aftercareTattooLabel(bookingTitle: string | null, serviceName: string | null): string {
  const pick = (s: string | null) => (s && s.trim() ? s.trim() : null);
  return pick(bookingTitle) ?? pick(serviceName) ?? "your new ink";
}

export function firstName(displayName: string | null): string {
  const n = (displayName ?? "").trim();
  if (!n) return "your artist";
  return n.split(/\s+/)[0] ?? "your artist";
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The client-facing notification copy. `nudgeReview` only affects week_3. */
export function buildAftercareCheckinMessage(
  kind: AftercareKind,
  tattooLabel: string,
  artistFirstName: string,
  nudgeReview: boolean,
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
    case "week_3": {
      const reviewLine = nudgeReview ? ` and leave ${artist} a review` : "";
      return {
        title: "Nearly healed",
        body: `Three weeks on, ${label} should be settling in nicely. Tap to share a healed photo with ${artist}${reviewLine}.`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

const DUE_STATUS = "pending";

/** Plan a single due row into a dispatch (or a skip when aftercare is off). */
export function planAftercareDispatch(row: DueAftercareRowLike): AftercareDispatch {
  const tattooLabel = aftercareTattooLabel(row.booking_title, row.service_name);
  const artistFirstName = firstName(row.artist_display_name);
  const nudgeReview = row.kind === "week_3" && !row.has_review;
  const disabled = row.aftercare_enabled !== true;
  return {
    checkinId: row.id,
    kind: row.kind,
    clientId: row.client_id,
    artistId: row.artist_id,
    bookingId: row.booking_id,
    sessionId: row.session_id,
    disabled,
    tattooLabel,
    artistFirstName,
    nudgeReview,
    message: buildAftercareCheckinMessage(row.kind, tattooLabel, artistFirstName, nudgeReview),
    actionUrl: `/aftercare/${row.id}`,
  };
}

/**
 * The due-finder: keep only pending rows whose scheduled time has passed, and
 * plan each. The DB query already filters status + scheduled_for; this re-checks
 * defensively (and is the unit-tested seam) so a stale/racey row never sends.
 */
export function selectDueAftercareCheckins(
  rows: readonly DueAftercareRowLike[],
  now: Date,
): AftercareDispatch[] {
  const out: AftercareDispatch[] = [];
  for (const r of rows) {
    if (r.status !== DUE_STATUS) continue;
    const dueMs = new Date(r.scheduled_for).getTime();
    if (Number.isNaN(dueMs) || dueMs > now.getTime()) continue;
    out.push(planAftercareDispatch(r));
  }
  return out;
}

/** The artist-facing touch-up/rebook nudge copy for a week_3 check-in. */
export function buildTouchUpNudge(tattooLabel: string, clientFirstName: string): AftercareMessage {
  const client = clientFirstName.trim() || "your client";
  const label = tattooLabel.trim() || "their tattoo";
  return {
    title: "Touch-up opportunity",
    body: `${capitalize(client)}'s ${label} is at the 3-week mark — a good moment to offer a touch-up or the next session.`,
  };
}
