// Offline unit tests proving the pure availability projection is correct when a
// weekday has MULTIPLE open windows (split day). Runs under Node's built-in
// runner with type-stripping (Node >= 22.6):
//   node --test packages/core/src/booking/slots.test.ts
//
// The weekly-hours grid persists one `availability_rules` row per open window,
// so a single weekday can carry several rows. computeBookableDates must project
// every such day as bookable and expose its windows (merged where contiguous)
// — regressions here would silently drop split-day availability from intake.
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeBookableDates } from "./slots.ts";
import type { AvailabilityRule, AvailabilityBlock } from "../types/rows";

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

// A fixed Monday anchor keeps weekday math deterministic. 2026-07-13 is a Monday.
const NOW = new Date("2026-07-13T12:00:00Z");

test("split day: two windows on the same weekday both surface, unmerged when apart", () => {
  const rules = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
    rule({ id: "b", weekday: 2, start_time: "17:00:00", end_time: "21:00:00" }),
  ];
  const days = computeBookableDates({
    rules,
    bookingWindow: "1mo",
    minNoticeHours: 0,
    now: NOW,
  });
  const tuesdays = days.filter((d) => d.weekday === 2);
  assert.ok(tuesdays.length > 0, "at least one Tuesday is bookable");
  for (const d of tuesdays) {
    assert.deepEqual(
      d.windows,
      [
        { start: "11:00", end: "14:00" },
        { start: "17:00", end: "21:00" },
      ],
      "both split windows are present and ordered",
    );
  }
  // No non-Tuesday day is bookable (only weekday 2 has rules).
  assert.ok(days.every((d) => d.weekday === 2));
});

test("split day: adjacent windows merge into one contiguous window", () => {
  const rules = [
    rule({ id: "a", weekday: 3, start_time: "10:00:00", end_time: "13:00:00" }),
    rule({ id: "b", weekday: 3, start_time: "13:00:00", end_time: "18:00:00" }),
  ];
  const days = computeBookableDates({
    rules,
    bookingWindow: "1mo",
    minNoticeHours: 0,
    now: NOW,
  });
  const wed = days.find((d) => d.weekday === 3);
  assert.ok(wed);
  assert.deepEqual(wed!.windows, [{ start: "10:00", end: "18:00" }]);
});

test("split day still hidden when a full-day time-off block covers it", () => {
  const rules = [
    rule({ id: "a", weekday: 2, start_time: "11:00:00", end_time: "14:00:00" }),
    rule({ id: "b", weekday: 2, start_time: "17:00:00", end_time: "21:00:00" }),
  ];
  // Block the first upcoming Tuesday (2026-07-14) entirely.
  const blocks: AvailabilityBlock[] = [
    {
      id: "blk",
      artist_id: "artist-1",
      location_id: null,
      block_type: "vacation",
      starts_at: "2026-07-14T00:00:00Z",
      ends_at: "2026-07-15T00:00:00Z",
      is_available: false,
      reason: null,
      created_at: "2026-07-13T00:00:00Z",
      updated_at: "2026-07-13T00:00:00Z",
    } as AvailabilityBlock,
  ];
  const days = computeBookableDates({
    rules,
    blocks,
    bookingWindow: "1mo",
    minNoticeHours: 0,
    now: NOW,
  });
  assert.ok(
    !days.some((d) => d.date === "2026-07-14"),
    "the blocked Tuesday is removed even though it had multiple open windows",
  );
  // Later Tuesdays remain bookable with both windows.
  const laterTue = days.find((d) => d.weekday === 2);
  assert.ok(laterTue);
  assert.equal(laterTue!.windows.length, 2);
});
