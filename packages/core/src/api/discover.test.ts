// Offline unit tests for the pure discover filter/param helpers. Runs under
// Node's built-in runner with type-stripping (Node >= 22.6):
//   node --test packages/core/src/api/discover.test.ts
//
// These pin the URL -> filter -> RPC-param pipeline that broke discovery in the
// field: an absent `lat`/`lng` URL param must NOT collapse to 0 (null island),
// which would send the RPC a bogus (0,0) center with the default radius and
// return zero artists on first load. Also covers the miles<->km conversion that
// the distance filter depends on.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  queryToDiscoverFilter,
  discoverFilterToParams,
  parseDiscoverSearchParams,
  EMPTY_FILTER_STATE,
  KM_PER_MILE,
  kmToMiles,
  milesToKm,
  radiusMatchesMiles,
  DEFAULT_RADIUS_MI,
} from "./discover.ts";

/** A `URLSearchParams`-like getter over a plain record; missing keys -> null. */
function getter(params: Record<string, string> = {}) {
  return (key: string): string | null =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key]! : null;
}

// ---------------------------------------------------------------------------
// #1 — the null-island regression. First load = empty URL.
// ---------------------------------------------------------------------------
test("queryToDiscoverFilter: empty URL yields NO center (not lat/lng = 0)", () => {
  const f = queryToDiscoverFilter(getter({}));
  assert.equal(f.lat, undefined, "lat must be undefined when absent, not 0");
  assert.equal(f.lng, undefined, "lng must be undefined when absent, not 0");
  assert.equal(f.radiusKm, undefined);
  assert.equal(f.city, undefined);
  assert.deepEqual(f.styles, []);
});

test("discoverFilterToParams: first-load (empty) filter sends no center to the RPC", () => {
  const f = queryToDiscoverFilter(getter({}));
  const p = discoverFilterToParams(f);
  // No center => the RPC must not receive lat/lng/radiusKm. If lat/lng were 0
  // and radius defaulted to 25km, search_artists returns 0 rows (null island).
  assert.equal(p.lat, undefined);
  assert.equal(p.lng, undefined);
  assert.equal(p.radiusKm, undefined);
});

test("discoverFilterToParams: EMPTY_FILTER_STATE has no center", () => {
  const p = discoverFilterToParams(EMPTY_FILTER_STATE);
  assert.equal(p.lat, undefined);
  assert.equal(p.lng, undefined);
  assert.equal(p.radiusKm, undefined);
});

test("parseDiscoverSearchParams: empty URL yields no center", () => {
  const p = parseDiscoverSearchParams(getter({}));
  assert.equal(p.lat, undefined);
  assert.equal(p.lng, undefined);
  assert.equal(p.radiusKm, undefined);
});

// A real center IS preserved (regression guard the fix must not over-correct).
test("queryToDiscoverFilter: explicit lat/lng are kept and drive a center", () => {
  const f = queryToDiscoverFilter(getter({ lat: "39.2904", lng: "-76.6122", radius: "40" }));
  assert.equal(f.lat, 39.2904);
  assert.equal(f.lng, -76.6122);
  assert.equal(f.radiusKm, 40);
  const p = discoverFilterToParams(f);
  assert.equal(p.lat, 39.2904);
  assert.equal(p.lng, -76.6122);
  assert.equal(p.radiusKm, 40);
});

test("queryToDiscoverFilter: city quick-pick sets the center from the metro centroid", () => {
  const f = queryToDiscoverFilter(getter({ city: "baltimore" }));
  assert.equal(f.city, "baltimore");
  assert.equal(f.lat, 39.2904);
  assert.equal(f.lng, -76.6122);
});

// ---------------------------------------------------------------------------
// miles <-> km conversion (distance filter correctness)
// ---------------------------------------------------------------------------
test("miles<->km: round-trips and matches the known factor", () => {
  assert.equal(KM_PER_MILE, 1.609344);
  assert.ok(Math.abs(milesToKm(1) - 1.609344) < 1e-9);
  assert.ok(Math.abs(kmToMiles(1.609344) - 1) < 1e-9);
  for (const mi of [0, 3, 10, 25, 50]) {
    assert.ok(Math.abs(kmToMiles(milesToKm(mi)) - mi) < 1e-9, `round-trip ${mi}mi`);
  }
});

test("radiusMatchesMiles: float-safe preset matching", () => {
  assert.equal(radiusMatchesMiles(milesToKm(DEFAULT_RADIUS_MI), DEFAULT_RADIUS_MI), true);
  assert.equal(radiusMatchesMiles(milesToKm(25), 25), true);
  assert.equal(radiusMatchesMiles(milesToKm(25), 10), false);
  assert.equal(radiusMatchesMiles(undefined, 25), false);
});
