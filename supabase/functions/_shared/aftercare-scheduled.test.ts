// Offline tests for the aftercare scheduled due-finder + dispatch planner.
// Mocked rows, no network. Guards: only pending+due rows fan out, a disabled
// artist is skipped (never sent), and week_3 review-nudge copy is conditional.
//   node --test supabase/functions/_shared/aftercare-scheduled.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  selectDueAftercareCheckins,
  planAftercareDispatch,
  buildAftercareCheckinMessage,
  buildTouchUpNudge,
  aftercareTattooLabel,
  firstName,
  type DueAftercareRowLike,
} from "./aftercare-scheduled.ts";

const NOW = new Date("2026-07-20T12:00:00.000Z");

function row(p: Partial<DueAftercareRowLike> & { id: string }): DueAftercareRowLike {
  return {
    kind: "day_3",
    status: "pending",
    scheduled_for: "2026-07-20T00:00:00.000Z", // due
    session_id: "sess-1",
    booking_id: "book-1",
    client_id: "client-1",
    artist_id: "artist-1",
    aftercare_enabled: true,
    artist_display_name: "Jayden Cole",
    booking_title: "poppy cluster",
    service_name: "Half day",
    has_review: false,
    ...p,
  };
}

test("only pending rows whose scheduled_for has passed are selected", () => {
  const rows = [
    row({ id: "due", scheduled_for: "2026-07-20T11:59:00.000Z" }),
    row({ id: "boundary", scheduled_for: "2026-07-20T12:00:00.000Z" }), // <= now -> due
    row({ id: "future", scheduled_for: "2026-07-20T12:01:00.000Z" }),
    row({ id: "already-sent", status: "sent" }),
    row({ id: "responded", status: "responded" }),
  ];
  const plans = selectDueAftercareCheckins(rows, NOW);
  assert.deepEqual(plans.map((p) => p.checkinId).sort(), ["boundary", "due"]);
});

test("disabled artist (aftercare off) is planned as a skip, not a send", () => {
  const plan = planAftercareDispatch(row({ id: "x", aftercare_enabled: false }));
  assert.equal(plan.disabled, true);
});

test("dispatch carries a warm, grounded message + deep link", () => {
  const plan = planAftercareDispatch(row({ id: "c1", kind: "day_3" }));
  assert.equal(plan.disabled, false);
  assert.match(plan.message.body, /poppy cluster/);
  assert.match(plan.message.body, /Jayden/);
  assert.equal(plan.actionUrl, "/aftercare/c1");
  assert.equal(plan.tattooLabel, "poppy cluster");
  assert.equal(plan.artistFirstName, "Jayden");
});

test("week_3 nudges a review only when the client hasn't reviewed", () => {
  const notReviewed = planAftercareDispatch(row({ id: "w3a", kind: "week_3", has_review: false }));
  assert.equal(notReviewed.nudgeReview, true);
  assert.match(notReviewed.message.body, /review/i);

  const reviewed = planAftercareDispatch(row({ id: "w3b", kind: "week_3", has_review: true }));
  assert.equal(reviewed.nudgeReview, false);
  assert.doesNotMatch(reviewed.message.body, /review/i);
});

test("earlier kinds never mention reviews", () => {
  const d3 = buildAftercareCheckinMessage("day_3", "poppy cluster", "Jayden", false);
  const w1 = buildAftercareCheckinMessage("week_1", "poppy cluster", "Jayden", false);
  assert.doesNotMatch(d3.body, /review/i);
  assert.doesNotMatch(w1.body, /review/i);
});

test("tattoo label + firstName fallbacks", () => {
  assert.equal(aftercareTattooLabel(null, "Half day"), "Half day");
  assert.equal(aftercareTattooLabel(null, null), "your new ink");
  assert.equal(firstName(null), "your artist");
  assert.equal(firstName("Mara Vance"), "Mara");
});

test("artist touch-up nudge copy", () => {
  const n = buildTouchUpNudge("poppy cluster", "Mara");
  assert.match(n.body, /poppy cluster/);
  assert.match(n.body, /Mara/);
  assert.match(n.title, /Touch-up/i);
});
