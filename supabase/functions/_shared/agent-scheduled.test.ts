// Offline tests for the Studio Manager scheduled-job selection logic +
// templates — mocked DB rows, no network, no Anthropic key.
//   node --test supabase/functions/_shared/agent-scheduled.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDepositChaseDraft,
  buildRebookNudgeDraft,
  buildWeeklyDigestSummary,
  depositChaseContextUsed,
  depositChaseDedupeKey,
  isMonday,
  isoWeek,
  rebookNudgeContextUsed,
  rebookNudgeDedupeKey,
  selectDepositChaseCandidates,
  selectRebookNudgeCandidates,
  weeklyDigestContextUsed,
  weeklyDigestDedupeKey,
  type CompletedSessionRow,
  type DepositChaseSessionRow,
} from "./agent-scheduled.ts";

const NOW = new Date("2026-07-15T20:00:00.000Z"); // Wednesday

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(d: number): string {
  return new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// deposit_chase selection
// ---------------------------------------------------------------------------

function depositSession(overrides: Partial<DepositChaseSessionRow>): DepositChaseSessionRow {
  return {
    id: "sess-1",
    booking_id: "book-1",
    client_id: "client-1",
    status: "scheduled",
    created_at: hoursAgo(100),
    scheduled_start: daysFromNow(10),
    deposit_cents: 10000,
    deposit_paid: false,
    service_name: "Half-day session",
    ...overrides,
  };
}

test("deposit_chase: selects a session booked >72h ago with an unpaid deposit", () => {
  const out = selectDepositChaseCandidates([depositSession({})], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.sessionId, "sess-1");
  assert.equal(out[0]!.depositCents, 10000);
  assert.ok(out[0]!.hoursSinceBooked >= 72);
});

test("deposit_chase: excludes a session booked less than 72h ago", () => {
  const out = selectDepositChaseCandidates(
    [depositSession({ id: "sess-recent", created_at: hoursAgo(10) })],
    NOW,
  );
  assert.equal(out.length, 0);
});

test("deposit_chase: excludes a session whose deposit is already paid", () => {
  const out = selectDepositChaseCandidates(
    [depositSession({ id: "sess-paid", deposit_paid: true })],
    NOW,
  );
  assert.equal(out.length, 0);
});

test("deposit_chase: excludes a session with no deposit required", () => {
  const out = selectDepositChaseCandidates(
    [depositSession({ id: "sess-nodep", deposit_cents: 0 })],
    NOW,
  );
  assert.equal(out.length, 0);
});

test("deposit_chase: excludes cancelled / completed / no_show sessions", () => {
  for (const status of ["cancelled", "completed", "no_show", "rescheduled"]) {
    const out = selectDepositChaseCandidates(
      [depositSession({ id: `sess-${status}`, status })],
      NOW,
    );
    assert.equal(out.length, 0, `status=${status} should be excluded`);
  }
});

test("deposit_chase: multiple qualifying sessions all surface", () => {
  const out = selectDepositChaseCandidates(
    [
      depositSession({ id: "a", client_id: "c1" }),
      depositSession({ id: "b", client_id: "c2", created_at: hoursAgo(200) }),
    ],
    NOW,
  );
  assert.equal(out.length, 2);
});

test("deposit_chase: draft template states exactly the candidate's deposit amount", () => {
  const [c] = selectDepositChaseCandidates([depositSession({})], NOW);
  const draft = buildDepositChaseDraft(c!);
  assert.match(draft, /\$100\.00/);
  assert.match(draft, /Half-day session/);
});

test("deposit_chase: context_used cites the session and the deposit — grounded against the draft", () => {
  const [c] = selectDepositChaseCandidates([depositSession({})], NOW);
  const draft = buildDepositChaseDraft(c!);
  const ctx = depositChaseContextUsed(c!);
  assert.equal(ctx.length, 2);
  assert.equal(ctx[0]!.source, "services");
  assert.equal(ctx[1]!.source, "booking_policy");
  // The $ figure in the draft must appear verbatim in some context_used detail
  // (mirrors the policy engine's grounding invariant, agent-policy.ts).
  const money = draft.match(/\$\d[\d,]*\.\d{2}/)![0];
  assert.ok(ctx.some((e) => e.detail.includes(money)));
});

test("deposit_chase: dedupe key is per-session, per-ISO-week (allows a re-chase next week)", () => {
  const key1 = depositChaseDedupeKey("sess-1", NOW);
  const key2 = depositChaseDedupeKey("sess-1", new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000));
  assert.equal(key1, "deposit_chase:sess-1:2026-W29");
  assert.notEqual(key1, key2);
});

// ---------------------------------------------------------------------------
// rebook_nudge selection
// ---------------------------------------------------------------------------

function completedSession(overrides: Partial<CompletedSessionRow>): CompletedSessionRow {
  return {
    id: "sess-c1",
    booking_id: "book-c1",
    client_id: "client-1",
    status: "completed",
    scheduled_end: daysAgo(40),
    updated_at: daysAgo(40),
    service_name: "Full sleeve — session 2",
    ...overrides,
  };
}

test("rebook_nudge: selects a completed session 30+ days old with no future session", () => {
  const out = selectRebookNudgeCandidates([completedSession({})], new Set(), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.clientId, "client-1");
  assert.ok(out[0]!.daysSinceCompleted >= 30);
});

test("rebook_nudge: excludes a session completed less than 30 days ago", () => {
  const out = selectRebookNudgeCandidates(
    [completedSession({ id: "recent", scheduled_end: daysAgo(5), updated_at: daysAgo(5) })],
    new Set(),
    NOW,
  );
  assert.equal(out.length, 0);
});

test("rebook_nudge: excludes a client who already has a future session booked", () => {
  const out = selectRebookNudgeCandidates(
    [completedSession({})],
    new Set(["client-1"]),
    NOW,
  );
  assert.equal(out.length, 0);
});

test("rebook_nudge: excludes non-completed sessions (scheduled/cancelled/no_show)", () => {
  for (const status of ["scheduled", "confirmed", "cancelled", "no_show"]) {
    const out = selectRebookNudgeCandidates(
      [completedSession({ id: `s-${status}`, status })],
      new Set(),
      NOW,
    );
    assert.equal(out.length, 0, `status=${status} should be excluded`);
  }
});

test("rebook_nudge: dedupes to the most recent completed session per client", () => {
  const out = selectRebookNudgeCandidates(
    [
      completedSession({ id: "older", scheduled_end: daysAgo(90), updated_at: daysAgo(90) }),
      completedSession({ id: "newer", scheduled_end: daysAgo(35), updated_at: daysAgo(35) }),
    ],
    new Set(),
    NOW,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.sessionId, "newer");
});

test("rebook_nudge: two different clients both surface", () => {
  const out = selectRebookNudgeCandidates(
    [completedSession({ id: "a", client_id: "c1" }), completedSession({ id: "b", client_id: "c2" })],
    new Set(),
    NOW,
  );
  assert.equal(out.length, 2);
});

test("rebook_nudge: draft template invites rebooking and cites the completed service", () => {
  const [c] = selectRebookNudgeCandidates([completedSession({})], new Set(), NOW);
  const draft = buildRebookNudgeDraft(c!);
  assert.match(draft, /Full sleeve — session 2/);
  assert.match(draft, /next session/i);
});

test("rebook_nudge: context_used cites the completed session", () => {
  const [c] = selectRebookNudgeCandidates([completedSession({})], new Set(), NOW);
  const ctx = rebookNudgeContextUsed(c!);
  assert.equal(ctx.length, 1);
  assert.equal(ctx[0]!.source, "services");
});

test("rebook_nudge: dedupe key is per-session only (one-shot nudge, never re-fires)", () => {
  assert.equal(rebookNudgeDedupeKey("sess-c1"), "rebook_nudge:sess-c1");
});

// ---------------------------------------------------------------------------
// weekly_digest
// ---------------------------------------------------------------------------

test("weekly_digest: summary states every count and the deposits total", () => {
  const summary = buildWeeklyDigestSummary(
    { newRequests: 3, sessionsDone: 2, depositsHeldCents: 45000, pendingApprovals: 4 },
    NOW,
  );
  assert.match(summary.body, /3 new requests/);
  assert.match(summary.body, /2 sessions done/);
  assert.match(summary.body, /\$450\.00 in deposits held/);
  assert.match(summary.body, /4 pending approvals/);
  assert.equal(summary.data.week, "2026-W29");
});

test("weekly_digest: singular counts read grammatically", () => {
  const summary = buildWeeklyDigestSummary(
    { newRequests: 1, sessionsDone: 1, depositsHeldCents: 0, pendingApprovals: 1 },
    NOW,
  );
  assert.match(summary.body, /1 new request(?!s)/);
  assert.match(summary.body, /1 session done/);
  assert.match(summary.body, /1 pending approval(?!s)/);
});

test("weekly_digest: context_used mirrors the digest numbers (auditable)", () => {
  const counts = { newRequests: 2, sessionsDone: 0, depositsHeldCents: 10000, pendingApprovals: 0 };
  const ctx = weeklyDigestContextUsed(counts, NOW);
  assert.equal(ctx.length, 1);
  assert.match(ctx[0]!.detail, /\$100\.00/);
});

test("weekly_digest: dedupe key is per-artist, per-ISO-week", () => {
  assert.equal(weeklyDigestDedupeKey("artist-1", NOW), "weekly_digest:artist-1:2026-W29");
});

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

test("isMonday: true only for Monday (UTC)", () => {
  assert.equal(isMonday(new Date("2026-07-13T12:00:00.000Z")), true); // Monday
  assert.equal(isMonday(new Date("2026-07-14T12:00:00.000Z")), false); // Tuesday
  assert.equal(isMonday(new Date("2026-07-15T20:00:00.000Z")), false); // Wednesday
});

test("isoWeek: matches ISO-8601 week numbering across a year boundary", () => {
  assert.equal(isoWeek(new Date("2026-01-01T00:00:00.000Z")), "2026-W01");
  assert.equal(isoWeek(new Date("2025-12-31T00:00:00.000Z")), "2026-W01"); // ISO week of Jan 1 2026
});
