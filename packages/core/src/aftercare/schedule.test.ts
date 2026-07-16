// Offline unit tests for the aftercare schedule generator + copy. Founder
// cadence is 3 DAYS / 1 WEEK / 3 WEEKS after completion (NOT 1/3/7) — these
// tests are the guardrail against the offsets silently drifting, and against
// the DB trigger / edge due-finder falling out of lockstep with them.
//   node --test packages/core/src/aftercare/schedule.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AFTERCARE_KINDS,
  AFTERCARE_OFFSET_DAYS,
  generateAftercareSchedule,
  isCheckinDue,
  aftercareKindLabel,
  aftercareTattooLabel,
  buildAftercareCheckinMessage,
  firstName,
} from "./schedule.ts";

const DAY = 24 * 60 * 60 * 1000;

test("completion generates exactly 3 check-ins at 3d / 7d / 21d", () => {
  const completedAt = new Date("2026-07-16T15:00:00.000Z");
  const rows = generateAftercareSchedule(completedAt);

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["day_3", "week_1", "week_3"],
  );

  const base = completedAt.getTime();
  assert.equal(new Date(rows[0]!.scheduledFor).getTime(), base + 3 * DAY);
  assert.equal(new Date(rows[1]!.scheduledFor).getTime(), base + 7 * DAY);
  assert.equal(new Date(rows[2]!.scheduledFor).getTime(), base + 21 * DAY);
});

test("offsets are 3 / 7 / 21 — NOT 1 / 3 / 7", () => {
  assert.deepEqual(AFTERCARE_KINDS, ["day_3", "week_1", "week_3"]);
  assert.equal(AFTERCARE_OFFSET_DAYS.day_3, 3);
  assert.equal(AFTERCARE_OFFSET_DAYS.week_1, 7);
  assert.equal(AFTERCARE_OFFSET_DAYS.week_3, 21);
  // Regression: none of the founder-rejected 1/3/7 values.
  assert.notEqual(AFTERCARE_OFFSET_DAYS.day_3, 1);
  assert.notEqual(AFTERCARE_OFFSET_DAYS.week_1, 3);
});

test("generateAftercareSchedule accepts an ISO string too", () => {
  const rows = generateAftercareSchedule("2026-07-16T00:00:00.000Z");
  assert.equal(rows[2]!.scheduledFor, "2026-08-06T00:00:00.000Z"); // +21d
});

test("isCheckinDue: passed vs future", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");
  assert.equal(isCheckinDue("2026-07-20T11:59:00.000Z", now), true);
  assert.equal(isCheckinDue("2026-07-20T12:00:00.000Z", now), true); // <= boundary
  assert.equal(isCheckinDue("2026-07-20T12:01:00.000Z", now), false);
});

test("kind labels", () => {
  assert.equal(aftercareKindLabel("day_3"), "3 days");
  assert.equal(aftercareKindLabel("week_1"), "1 week");
  assert.equal(aftercareKindLabel("week_3"), "3 weeks");
});

test("tattoo label prefers booking title, then service, then placement, then fallback", () => {
  assert.equal(
    aftercareTattooLabel({ bookingTitle: "poppy cluster", serviceName: "Half day", placement: "forearm" }),
    "poppy cluster",
  );
  assert.equal(aftercareTattooLabel({ serviceName: "Half day", placement: "forearm" }), "Half day");
  assert.equal(aftercareTattooLabel({ placement: "forearm" }), "forearm");
  assert.equal(aftercareTattooLabel({ bookingTitle: "   " }), "your new ink");
  assert.equal(aftercareTattooLabel({}), "your new ink");
});

test("firstName pulls the first token, falls back gracefully", () => {
  assert.equal(firstName("Jayden Cole"), "Jayden");
  assert.equal(firstName("  Mara  Vance "), "Mara");
  assert.equal(firstName(""), "your artist");
  assert.equal(firstName(null), "your artist");
});

test("check-in copy is warm, kind-specific, and names the piece + artist", () => {
  const d3 = buildAftercareCheckinMessage("day_3", "poppy cluster", "Jayden");
  assert.match(d3.body, /poppy cluster/);
  assert.match(d3.body, /Jayden/);

  const w3 = buildAftercareCheckinMessage("week_3", "poppy cluster", "Jayden");
  assert.match(w3.body, /review/i); // week_3 nudges a review
  assert.notEqual(d3.title, w3.title);
});
