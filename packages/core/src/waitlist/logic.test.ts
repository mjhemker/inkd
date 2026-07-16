// Offline unit tests for the pure waitlist logic (matching, sequential-cascade
// ordering + expiry, and the double-booking guard). These mirror the SQL in
// migration 20260717130000_waitlist.sql. Run with:
//   node --test packages/core/src/waitlist/logic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  matchesWindow,
  pickNextCandidate,
  computeOfferExpiry,
  isOfferExpired,
  offerCountdownMs,
  slotsOverlap,
  canClaimOffer,
  slotWallTime,
  WAITLIST_OFFER_TTL_MS,
  type MatchableEntry,
  type WaitlistSlot,
  type LiveSession,
} from "./logic.ts";

const ARTIST = "artist-1";

// A Wednesday 2026-07-22 at 14:00 America/New_York == 18:00Z (EDT, UTC-4).
const SLOT: WaitlistSlot = {
  artistId: ARTIST,
  serviceId: "svc-half-day",
  slotStart: new Date("2026-07-22T18:00:00Z"),
  slotEnd: new Date("2026-07-22T22:00:00Z"),
};

function entry(p: Partial<MatchableEntry> & { id: string }): MatchableEntry {
  return {
    artistId: ARTIST,
    status: "active",
    serviceId: null,
    earliestDate: null,
    latestDate: null,
    preferredWeekdays: null,
    preferredTimeStart: null,
    preferredTimeEnd: null,
    priority: 0,
    createdAt: "2026-07-15T00:00:00Z",
    ...p,
  };
}

// --- wall-time resolution ---------------------------------------------------
test("slotWallTime resolves ET local parts (EDT)", () => {
  const wt = slotWallTime(SLOT.slotStart);
  assert.equal(wt.date, "2026-07-22");
  assert.equal(wt.weekday, 3); // Wednesday
  assert.equal(wt.minutesOfDay, 14 * 60); // 2:00pm local
});

// --- matching ---------------------------------------------------------------
test("wide-open entry matches any slot for the artist", () => {
  assert.equal(matchesWindow(entry({ id: "a" }), SLOT), true);
});

test("service-specific entry only matches its own service", () => {
  assert.equal(matchesWindow(entry({ id: "a", serviceId: "svc-half-day" }), SLOT), true);
  assert.equal(matchesWindow(entry({ id: "b", serviceId: "svc-other" }), SLOT), false);
  // Null-service opening never matches a service-specific entry.
  assert.equal(
    matchesWindow(entry({ id: "c", serviceId: "svc-half-day" }), { ...SLOT, serviceId: null }),
    false,
  );
});

test("date window is inclusive and gates out-of-range slots", () => {
  assert.equal(
    matchesWindow(entry({ id: "a", earliestDate: "2026-07-22", latestDate: "2026-07-22" }), SLOT),
    true,
  );
  assert.equal(matchesWindow(entry({ id: "b", earliestDate: "2026-07-23" }), SLOT), false);
  assert.equal(matchesWindow(entry({ id: "c", latestDate: "2026-07-21" }), SLOT), false);
});

test("preferred weekdays filter (ET weekday)", () => {
  assert.equal(matchesWindow(entry({ id: "a", preferredWeekdays: [3] }), SLOT), true); // Wed
  assert.equal(matchesWindow(entry({ id: "b", preferredWeekdays: [1, 2] }), SLOT), false);
  assert.equal(matchesWindow(entry({ id: "c", preferredWeekdays: [] }), SLOT), true); // empty = any
});

test("preferred time band is [start, end) in ET", () => {
  assert.equal(
    matchesWindow(entry({ id: "a", preferredTimeStart: "12:00", preferredTimeEnd: "17:00" }), SLOT),
    true,
  );
  // Slot at 14:00; end is exclusive.
  assert.equal(
    matchesWindow(entry({ id: "b", preferredTimeStart: "15:00" }), SLOT),
    false,
  );
  assert.equal(matchesWindow(entry({ id: "c", preferredTimeEnd: "14:00" }), SLOT), false);
});

test("entry for a different artist never matches", () => {
  assert.equal(matchesWindow(entry({ id: "a", artistId: "artist-2" }), SLOT), false);
});

// --- cascade ordering (priority desc, then FIFO) ----------------------------
test("pickNextCandidate honors priority then FIFO, skips already-offered", () => {
  const riley = entry({ id: "riley", priority: 10, createdAt: "2026-07-15T10:00:00Z" });
  const morgan = entry({ id: "morgan", priority: 0, createdAt: "2026-07-14T09:00:00Z" });
  const early = entry({ id: "early", priority: 10, createdAt: "2026-07-10T09:00:00Z" });

  // Highest priority wins; among equal priority the earliest created wins.
  assert.equal(pickNextCandidate([riley, morgan, early], [], SLOT)?.id, "early");
  // Skip 'early' (already offered) -> next equal-priority is riley.
  assert.equal(pickNextCandidate([riley, morgan, early], ["early"], SLOT)?.id, "riley");
  // Skip both priority-10 -> falls to morgan.
  assert.equal(pickNextCandidate([riley, morgan, early], ["early", "riley"], SLOT)?.id, "morgan");
  // All offered -> exhausted.
  assert.equal(pickNextCandidate([riley, morgan, early], ["early", "riley", "morgan"], SLOT), null);
});

test("pickNextCandidate ignores non-active and non-matching entries", () => {
  const offered = entry({ id: "x", status: "offered", priority: 99 });
  const mismatch = entry({ id: "y", serviceId: "svc-other" });
  const good = entry({ id: "z" });
  assert.equal(pickNextCandidate([offered, mismatch, good], [], SLOT)?.id, "z");
});

// --- expiry -----------------------------------------------------------------
test("computeOfferExpiry caps TTL at the slot start", () => {
  const now = new Date("2026-07-22T10:00:00Z");
  // Slot is 8h away, TTL is 3h -> expiry = now + 3h.
  const e1 = computeOfferExpiry(now, SLOT.slotStart);
  assert.equal(e1?.toISOString(), new Date(now.getTime() + WAITLIST_OFFER_TTL_MS).toISOString());
  // Slot is 1h away -> capped at slot start.
  const near = new Date("2026-07-22T17:00:00Z");
  assert.equal(computeOfferExpiry(near, SLOT.slotStart)?.toISOString(), SLOT.slotStart.toISOString());
  // Slot already passed -> null (no offer).
  assert.equal(computeOfferExpiry(new Date("2026-07-22T18:00:00Z"), SLOT.slotStart), null);
});

test("isOfferExpired + countdown", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  assert.equal(isOfferExpired({ status: "pending", expiresAt: "2026-07-22T11:59:00Z" }, now), true);
  assert.equal(isOfferExpired({ status: "pending", expiresAt: "2026-07-22T15:00:00Z" }, now), false);
  assert.equal(isOfferExpired({ status: "expired", expiresAt: "2026-07-22T15:00:00Z" }, now), true);
  assert.equal(isOfferExpired({ status: "accepted", expiresAt: "2026-07-22T11:00:00Z" }, now), false);
  assert.equal(offerCountdownMs("2026-07-22T12:30:00Z", now), 30 * 60_000);
  assert.equal(offerCountdownMs("2026-07-22T11:00:00Z", now), 0);
});

// --- double-booking guard ---------------------------------------------------
test("slotsOverlap is half-open (touching edges do not overlap)", () => {
  const a0 = new Date("2026-07-22T18:00:00Z");
  const a1 = new Date("2026-07-22T22:00:00Z");
  assert.equal(slotsOverlap(a0, a1, new Date("2026-07-22T21:00:00Z"), new Date("2026-07-23T01:00:00Z")), true);
  assert.equal(slotsOverlap(a0, a1, a1, new Date("2026-07-23T00:00:00Z")), false); // touch at 22:00
});

test("canClaimOffer: only one claim wins once a session occupies the slot", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  const offer = {
    status: "pending",
    expiresAt: "2026-07-22T15:00:00Z",
    slotStart: SLOT.slotStart,
    slotEnd: SLOT.slotEnd,
  };

  // No live session yet -> first claimant may proceed.
  assert.deepEqual(canClaimOffer(offer, [], now), { ok: true });

  // After the first claim materializes a session, the second is rejected.
  const booked: LiveSession[] = [
    { status: "scheduled", scheduledStart: SLOT.slotStart, scheduledEnd: SLOT.slotEnd ?? null },
  ];
  assert.deepEqual(canClaimOffer(offer, booked, now), { ok: false, reason: "slot_taken" });

  // A cancelled session in the slot does NOT block (only scheduled/confirmed).
  const cancelled: LiveSession[] = [
    { status: "cancelled", scheduledStart: SLOT.slotStart, scheduledEnd: SLOT.slotEnd ?? null },
  ];
  assert.deepEqual(canClaimOffer(offer, cancelled, now), { ok: true });
});

test("canClaimOffer rejects non-pending / expired offers", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  const base = { slotStart: SLOT.slotStart, slotEnd: SLOT.slotEnd };
  assert.deepEqual(
    canClaimOffer({ status: "declined", expiresAt: "2026-07-22T15:00:00Z", ...base }, [], now),
    { ok: false, reason: "not_pending" },
  );
  assert.deepEqual(
    canClaimOffer({ status: "pending", expiresAt: "2026-07-22T11:00:00Z", ...base }, [], now),
    { ok: false, reason: "expired" },
  );
});
