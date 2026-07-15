// Offline unit tests for the pure geocoding helpers. Runs with zero deps under
// Node's built-in runner (type-stripping):
//   node --test supabase/functions/geocode-location/geocode.test.ts
// Egress from CI/sandbox may block the live Nominatim call in index.ts; these
// prove the request-building + response-parsing contract against a captured
// fixture so the parser is verified even when the network isn't reachable.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAddressQuery,
  normalizeCacheKey,
  buildNominatimUrl,
  parseNominatimResults,
  NOMINATIM_USER_AGENT,
} from "./geocode.ts";

test("buildAddressQuery: composes non-empty parts, defaults country", () => {
  assert.equal(
    buildAddressQuery({
      address_line1: "200 W Pratt St",
      address_line2: null,
      city: "Baltimore",
      state: "MD",
      postal_code: "21201",
      country: null,
    }),
    "200 W Pratt St, Baltimore, MD, 21201, US",
  );
});

test("buildAddressQuery: empty when nothing to geocode", () => {
  assert.equal(
    buildAddressQuery({
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
    }),
    "US",
  );
});

test("normalizeCacheKey: stable across punctuation/case/whitespace", () => {
  assert.equal(
    normalizeCacheKey("200 W. Pratt St.,  Baltimore, MD 21201"),
    "200 w pratt st baltimore md 21201",
  );
  assert.equal(
    normalizeCacheKey("200 w pratt st  baltimore md 21201"),
    "200 w pratt st baltimore md 21201",
  );
});

test("buildNominatimUrl: json, us-biased, single result", () => {
  const url = buildNominatimUrl("200 W Pratt St, Baltimore, MD");
  assert.match(url, /^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
  assert.match(url, /format=jsonv2/);
  assert.match(url, /limit=1/);
  assert.match(url, /countrycodes=us/);
});

test("NOMINATIM_USER_AGENT: identifies the pilot per usage policy", () => {
  assert.equal(NOMINATIM_USER_AGENT, "INKD-pilot/1.0 (getinkd.co)");
});

// A trimmed but realistic Nominatim jsonv2 response for the Inner Harbor.
const FIXTURE = [
  {
    place_id: 1234567,
    lat: "39.2857",
    lon: "-76.6121",
    display_name: "200, West Pratt Street, Baltimore, MD, 21201, United States",
    importance: 0.42,
  },
  {
    place_id: 7654321,
    lat: "39.2900",
    lon: "-76.6100",
    display_name: "Some other match",
  },
];

test("parseNominatimResults: returns the top hit as numbers", () => {
  const hit = parseNominatimResults(FIXTURE);
  assert.ok(hit);
  assert.equal(hit.lat, 39.2857);
  assert.equal(hit.lng, -76.6121);
  assert.match(hit.displayName ?? "", /West Pratt Street/);
});

test("parseNominatimResults: null on empty / malformed / out-of-range", () => {
  assert.equal(parseNominatimResults([]), null);
  assert.equal(parseNominatimResults(null), null);
  assert.equal(parseNominatimResults("nope"), null);
  assert.equal(parseNominatimResults([{ lat: "abc", lon: "-1" }]), null);
  assert.equal(parseNominatimResults([{ lat: "999", lon: "0" }]), null);
});
