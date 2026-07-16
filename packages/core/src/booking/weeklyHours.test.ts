// Offline unit tests for the weekly-hours editor helpers. Runs under Node's
// built-in runner with type-stripping (Node >= 22.6):
//   node --test packages/core/src/booking/weeklyHours.test.ts
//
// These pin the multi-block-per-day model: an artist can have several open
// windows on one weekday (Tue 11–14 + 17–21), and saving must reconcile the
// desired blocks against persisted rows with a minimal insert/update/delete
// plan — never a blind delete-all that churns unchanged rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  diffAvailabilityRules,
  mergeWeeklyBlocks,
  hasOverlap,
  rulesToBlocks,
  timeToMinutes,
  minutesToTime,
  snapMinutes,
  type WeeklyBlock,
} from "./weeklyHours.ts";
import type { AvailabilityRule } from "../types/rows";

function rule(partial: Partial<AvailabilityRule> & { id: string }): AvailabilityRule {
  return {
    artist_id: "artist-1",
    created_at: "2026-07-15T00:00:00Z",
    updated_at: "2026-07-15T00:00:00Z",
    location_id: null,
    is_open: true,
    weekday: 2,
    start_time: "11:00:00",
    end_time: "19:00:00",
    ...partial,
  } as AvailabilityRule;
}

// --- time helpers ----------------------------------------------------------
test("time <-> minutes round-trips and snaps", () => {
  assert.equal(timeToMinutes("11:00"), 660);
  assert.equal(timeToMinutes("17:45:00"), 1065);
  assert.equal(minutesToTime(660), "11:00");
  assert.equal(minutesToTime(1065), "17:45");
  assert.equal(snapMinutes(670), 675); // 15-min snap up
  assert.equal(snapMinutes(662), 660); // 15-min snap down
  assert.equal(minutesToTime(-30), "00:00"); // clamp low
  assert.equal(minutesToTime(2000), "24:00"); // clamp high
});

// --- rulesToBlocks ----------------------------------------------------------
test("rulesToBlocks keeps multiple open windows on one weekday, drops closed", () => {
  const rules = [
    rule({ id: "b", weekday: 2, start_time: "17:00:00", end_time: "21:00:00" }),
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
    rule({ id: "c", weekday: 4, start_time: "12:00:00", end_time: "20:00:00", is_open: false }),
  ];
  const blocks = rulesToBlocks(rules);
  assert.equal(blocks.length, 2, "closed rule excluded");
  // sorted by weekday then start
  assert.deepEqual(
    blocks.map((b) => [b.weekday, b.start, b.end, b.id]),
    [
      [2, "11:00", "14:00", "a"],
      [2, "17:00", "21:00", "b"],
    ],
  );
});

// --- overlap ----------------------------------------------------------------
test("hasOverlap: overlapping true, adjacent false, cross-day false", () => {
  const blocks: WeeklyBlock[] = [
    { id: "a", weekday: 2, start: "11:00", end: "14:00" },
  ];
  assert.equal(
    hasOverlap({ weekday: 2, start: "13:00", end: "16:00" }, blocks),
    true,
  );
  // adjacent (touching) is allowed
  assert.equal(
    hasOverlap({ weekday: 2, start: "14:00", end: "16:00" }, blocks),
    false,
  );
  // same window on a different weekday never overlaps
  assert.equal(
    hasOverlap({ weekday: 3, start: "12:00", end: "13:00" }, blocks),
    false,
  );
  // ignoreId excludes self when resizing
  assert.equal(
    hasOverlap({ id: "a", weekday: 2, start: "11:00", end: "18:00" }, blocks, "a"),
    false,
  );
});

// --- mergeWeeklyBlocks ------------------------------------------------------
test("mergeWeeklyBlocks merges overlapping/adjacent, keeps split days apart", () => {
  const merged = mergeWeeklyBlocks([
    { id: "a", weekday: 2, start: "11:00", end: "14:00" },
    { weekday: 2, start: "13:00", end: "15:00" }, // overlaps a → merge
    { weekday: 2, start: "17:00", end: "21:00" }, // separate window kept
    { weekday: 4, start: "12:00", end: "16:00" },
    { weekday: 4, start: "16:00", end: "18:00" }, // adjacent → merge
  ]);
  assert.deepEqual(
    merged.map((b) => [b.weekday, b.start, b.end]),
    [
      [2, "11:00", "15:00"],
      [2, "17:00", "21:00"],
      [4, "12:00", "18:00"],
    ],
  );
  // merged Tue-morning window keeps the persisted id so it reconciles as update
  assert.equal(merged[0]!.id, "a");
});

// --- diffAvailabilityRules (set reconciliation) -----------------------------
test("diff: unchanged rows produce no ops", () => {
  const existing = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
    rule({ id: "b", weekday: 2, start_time: "17:00:00", end_time: "21:00:00" }),
  ];
  const desired: WeeklyBlock[] = [
    { id: "a", weekday: 2, start: "11:00", end: "14:00" },
    { id: "b", weekday: 2, start: "17:00", end: "21:00" },
  ];
  const plan = diffAvailabilityRules(existing, desired);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toUpdate, []);
  assert.deepEqual(plan.toDelete, []);
});

test("diff: add a second block to a day → single insert, no churn", () => {
  const existing = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
  ];
  const desired: WeeklyBlock[] = [
    { id: "a", weekday: 2, start: "11:00", end: "14:00" },
    { weekday: 2, start: "17:00", end: "21:00" }, // new
  ];
  const plan = diffAvailabilityRules(existing, desired);
  assert.deepEqual(plan.toInsert, [{ weekday: 2, start: "17:00", end: "21:00" }]);
  assert.deepEqual(plan.toUpdate, []);
  assert.deepEqual(plan.toDelete, []);
});

test("diff: resize one block, delete another", () => {
  const existing = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
    rule({ id: "b", weekday: 2, start_time: "17:00:00", end_time: "21:00:00" }),
  ];
  const desired: WeeklyBlock[] = [
    { id: "a", weekday: 2, start: "11:00", end: "15:00" }, // resized
    // b removed
  ];
  const plan = diffAvailabilityRules(existing, desired);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toUpdate, [
    { id: "a", weekday: 2, start: "11:00", end: "15:00" },
  ]);
  assert.deepEqual(plan.toDelete, ["b"]);
});

test("diff: reopening a previously-closed row updates it", () => {
  const existing = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00", is_open: false }),
  ];
  const desired: WeeklyBlock[] = [
    { id: "a", weekday: 2, start: "11:00", end: "14:00" },
  ];
  const plan = diffAvailabilityRules(existing, desired);
  assert.equal(plan.toUpdate.length, 1);
  assert.equal(plan.toUpdate[0]!.id, "a");
});

test("diff: a desired id that no longer exists is treated as an insert", () => {
  const existing: AvailabilityRule[] = [];
  const desired: WeeklyBlock[] = [
    { id: "stale", weekday: 2, start: "11:00", end: "14:00" },
  ];
  const plan = diffAvailabilityRules(existing, desired);
  assert.deepEqual(plan.toInsert, [{ weekday: 2, start: "11:00", end: "14:00" }]);
  assert.deepEqual(plan.toDelete, []);
});

test("diff: clearing a day (empty desired) deletes all its rows", () => {
  const existing = [
    rule({ id: "a", weekday: 2 }),
    rule({ id: "b", weekday: 4 }),
  ];
  const plan = diffAvailabilityRules(existing, []);
  assert.deepEqual(plan.toDelete.sort(), ["a", "b"]);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toUpdate, []);
});
