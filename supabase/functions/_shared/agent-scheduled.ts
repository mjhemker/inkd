// Studio Manager scheduled jobs (SPEC §5: "deposit chasing, no-show follow-up,
// rebooking nudges, ... weekly business digest"). Fully DETERMINISTIC — no LLM
// call, no ANTHROPIC_API_KEY dependency. Templated drafts are built straight
// from real DB facts, so this runs identically before and after Michael wires
// the Anthropic key (unlike agent-run, which 503s without it — see
// agent-run/index.ts).
//
// Architecture note (see docs/agents-runtime.md "Scheduled jobs (Studio
// Manager)"): a SIBLING edge function (`agent-scheduled`) rather than an
// agent-run dispatch extension. Both share the same `agent_jobs` queue and the
// same `agent_jobs_lease` RPC — `job_kind` discriminates dispatch instead of
// `trigger_kind`/role. Tier + status are fixed by business rule here (no
// policy-engine autonomy lookup): deposit_chase / rebook_nudge always propose
// (tier 2, artist confirms before anything client-facing goes out) and
// weekly_digest always auto-executes (tier 1, internal note — mirrors
// `note.log`'s existing "always executes" rule in agent-policy.ts).
//
// Pure + dependency-free (erasable TypeScript) so it runs under node --test
// and Deno identically. The deployed edge function (agent-scheduled/index.ts)
// backs the DB reads/writes; this file never imports a client.

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ScheduledJobKind = "deposit_chase" | "rebook_nudge" | "weekly_digest";

export const SCHEDULED_JOB_KINDS: readonly ScheduledJobKind[] = [
  "deposit_chase",
  "rebook_nudge",
  "weekly_digest",
];

/** One context_used entry, matching the agent_actions contract
 * (docs/agents-runtime.md) — `source` must stay within that enum. */
export interface ContextUsedEntryLike {
  source: "services" | "availability" | "booking_policy" | "playbook" | "profile";
  detail: string;
}

export function formatCentsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// ISO week (YYYY-Www, UTC) — stable, timezone-agnostic dedupe granularity.
// ---------------------------------------------------------------------------
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Monday check (UTC) — gates the weekly_digest enqueue/scan. */
export function isMonday(now: Date): boolean {
  return now.getUTCDay() === 1;
}

// ---------------------------------------------------------------------------
// (a) deposit_chase
//   Sessions BOOKED (created_at) more than 72h ago that still have an unpaid
//   deposit. "Booked", not the appointment's own start time, deliberately:
//   the point is to chase a deposit that's gone stale since the client asked
//   to be put on the books, regardless of how far out the session itself is.
// ---------------------------------------------------------------------------

export interface DepositChaseSessionRow {
  id: string;
  booking_id: string;
  client_id: string;
  status: string; // session_status
  created_at: string; // ISO — when the session was booked
  scheduled_start: string | null;
  deposit_cents: number;
  deposit_paid: boolean;
  service_name: string | null;
}

export interface DepositChaseCandidate {
  sessionId: string;
  bookingId: string;
  clientId: string;
  depositCents: number;
  serviceName: string | null;
  scheduledStart: string | null;
  hoursSinceBooked: number;
}

const DEPOSIT_CHASE_LIVE_STATUSES = new Set(["scheduled", "confirmed"]);
export const DEPOSIT_CHASE_MIN_HOURS = 72;

export function selectDepositChaseCandidates(
  sessions: readonly DepositChaseSessionRow[],
  now: Date,
): DepositChaseCandidate[] {
  const out: DepositChaseCandidate[] = [];
  for (const s of sessions) {
    if (!DEPOSIT_CHASE_LIVE_STATUSES.has(s.status)) continue;
    if (s.deposit_paid || s.deposit_cents <= 0) continue;
    const bookedAtMs = new Date(s.created_at).getTime();
    if (Number.isNaN(bookedAtMs)) continue;
    const hours = (now.getTime() - bookedAtMs) / (60 * 60 * 1000);
    if (hours < DEPOSIT_CHASE_MIN_HOURS) continue;
    out.push({
      sessionId: s.id,
      bookingId: s.booking_id,
      clientId: s.client_id,
      depositCents: s.deposit_cents,
      serviceName: s.service_name,
      scheduledStart: s.scheduled_start,
      hoursSinceBooked: hours,
    });
  }
  return out;
}

function formatDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** The templated, playbook-toned reminder. Every $ figure comes straight from
 * the candidate, so it's grounded by construction (no model involved). */
export function buildDepositChaseDraft(c: DepositChaseCandidate): string {
  const when = c.scheduledStart ? ` for ${formatDay(c.scheduledStart)}` : "";
  const service = c.serviceName ? ` (${c.serviceName})` : "";
  return (
    `Hey! Just a friendly reminder — your session${when}${service} is on the books, but the ` +
    `${formatCentsUsd(c.depositCents)} deposit to lock it in is still outstanding. Whenever you ` +
    `get a chance, send that over and you're all set. Let me know if you have any questions!`
  );
}

export function depositChaseContextUsed(c: DepositChaseCandidate): ContextUsedEntryLike[] {
  return [
    {
      source: "services",
      detail: `${c.serviceName ?? "Session"} — booked ${Math.floor(c.hoursSinceBooked)}h ago`,
    },
    {
      source: "booking_policy",
      detail: `Deposit outstanding: ${formatCentsUsd(c.depositCents)}, unpaid`,
    },
  ];
}

export function depositChaseDedupeKey(sessionId: string, now: Date): string {
  return `deposit_chase:${sessionId}:${isoWeek(now)}`;
}

// ---------------------------------------------------------------------------
// (b) rebook_nudge
//   The most recent COMPLETED session per client, 30+ days old, for clients
//   with no future scheduled/confirmed session with this artist.
// ---------------------------------------------------------------------------

export interface CompletedSessionRow {
  id: string;
  booking_id: string;
  client_id: string;
  status: string; // session_status
  scheduled_end: string | null;
  updated_at: string;
  service_name: string | null;
}

export interface RebookCandidate {
  sessionId: string;
  bookingId: string;
  clientId: string;
  completedAt: string;
  serviceName: string | null;
  daysSinceCompleted: number;
}

export const REBOOK_MIN_DAYS = 30;

export function selectRebookNudgeCandidates(
  completed: readonly CompletedSessionRow[],
  futureClientIds: ReadonlySet<string>,
  now: Date,
): RebookCandidate[] {
  const byClient = new Map<string, CompletedSessionRow>();
  for (const s of completed) {
    if (s.status !== "completed") continue;
    if (futureClientIds.has(s.client_id)) continue;
    const existing = byClient.get(s.client_id);
    if (!existing) {
      byClient.set(s.client_id, s);
      continue;
    }
    const completedAt = s.scheduled_end ?? s.updated_at;
    const existingAt = existing.scheduled_end ?? existing.updated_at;
    if (new Date(completedAt).getTime() > new Date(existingAt).getTime()) {
      byClient.set(s.client_id, s);
    }
  }

  const out: RebookCandidate[] = [];
  for (const s of byClient.values()) {
    const completedAt = s.scheduled_end ?? s.updated_at;
    const completedAtMs = new Date(completedAt).getTime();
    if (Number.isNaN(completedAtMs)) continue;
    const days = (now.getTime() - completedAtMs) / (24 * 60 * 60 * 1000);
    if (days < REBOOK_MIN_DAYS) continue;
    out.push({
      sessionId: s.id,
      bookingId: s.booking_id,
      clientId: s.client_id,
      completedAt,
      serviceName: s.service_name,
      daysSinceCompleted: days,
    });
  }
  return out;
}

export function buildRebookNudgeDraft(c: RebookCandidate): string {
  const service = c.serviceName ? ` after your ${c.serviceName}` : "";
  return (
    `Hey! Hope you're loving how the piece healed up${service}. Whenever you're ready for the ` +
    `next session (or something new), just say the word and I'll get you on the books.`
  );
}

export function rebookNudgeContextUsed(c: RebookCandidate): ContextUsedEntryLike[] {
  return [
    {
      source: "services",
      detail: `${c.serviceName ?? "Session"} completed ${Math.floor(c.daysSinceCompleted)}d ago, no future session on file`,
    },
  ];
}

export function rebookNudgeDedupeKey(sessionId: string): string {
  return `rebook_nudge:${sessionId}`;
}

// ---------------------------------------------------------------------------
// (c) weekly_digest — every Monday, per artist, an internal rollup.
// ---------------------------------------------------------------------------

export interface WeeklyDigestCounts {
  newRequests: number;
  sessionsDone: number;
  depositsHeldCents: number;
  pendingApprovals: number;
}

export interface WeeklyDigestSummary {
  title: string;
  body: string;
  data: WeeklyDigestCounts & { week: string };
  reasoningSummary: string;
}

export function buildWeeklyDigestSummary(
  counts: WeeklyDigestCounts,
  now: Date,
): WeeklyDigestSummary {
  const week = isoWeek(now);
  const body = [
    `${counts.newRequests} new request${counts.newRequests === 1 ? "" : "s"}`,
    `${counts.sessionsDone} session${counts.sessionsDone === 1 ? "" : "s"} done`,
    `${formatCentsUsd(counts.depositsHeldCents)} in deposits held`,
    `${counts.pendingApprovals} pending approval${counts.pendingApprovals === 1 ? "" : "s"}`,
  ].join(" · ");
  return {
    title: "Your week at a glance",
    body,
    data: { ...counts, week },
    reasoningSummary: `Weekly digest for ${week}: ${body}.`,
  };
}

export function weeklyDigestContextUsed(counts: WeeklyDigestCounts, now: Date): ContextUsedEntryLike[] {
  return [
    {
      source: "booking_policy",
      detail: `${isoWeek(now)}: ${counts.newRequests} new requests, ${counts.sessionsDone} sessions done, ` +
        `${formatCentsUsd(counts.depositsHeldCents)} deposits held, ${counts.pendingApprovals} pending approvals`,
    },
  ];
}

export function weeklyDigestDedupeKey(artistId: string, now: Date): string {
  return `weekly_digest:${artistId}:${isoWeek(now)}`;
}
