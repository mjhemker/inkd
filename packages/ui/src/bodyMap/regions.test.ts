// Offline unit tests for the body-map placement domain. Pure functions, so
// they run under Node's built-in runner with type-stripping (Node >= 22.6):
//   node --test packages/ui/src/bodyMap/regions.test.ts
//
// Covers the two contracts the UI + DB layers depend on: the region→label
// mapping (laterality, multi-word bases, non-lateral regions) and the
// structured-value ⇄ DB-columns round-trip.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FIGURES,
  REGION_DEFS,
  placementLabel,
  serializePlacement,
  parsePlacement,
  placementLabelFromColumns,
  placementSelectOptions,
  encodeOption,
  decodeOption,
  samePlacement,
  isRegionKey,
  type PlacementValue,
} from "./regions.ts";

// --- Region → label ---------------------------------------------------------
test("lateral region label prefixes the side", () => {
  assert.equal(placementLabel({ region: "forearm", side: "left" }), "Left forearm");
  assert.equal(placementLabel({ region: "forearm", side: "right" }), "Right forearm");
});

test("multi-word base label reads naturally with a side", () => {
  assert.equal(placementLabel({ region: "upperArm", side: "left" }), "Left upper arm");
});

test("non-lateral region ignores side", () => {
  assert.equal(placementLabel({ region: "chest", side: null }), "Chest");
  assert.equal(placementLabel({ region: "fullBack", side: null }), "Full back");
});

test("withView annotates back placements", () => {
  assert.equal(
    placementLabel({ region: "shoulder", side: "right" }, { withView: "back" }),
    "Right shoulder (back)",
  );
});

// --- Round-trip: value → columns → value ------------------------------------
test("round-trips a lateral placement through DB columns", () => {
  const value: PlacementValue = { region: "forearm", side: "left", view: "front" };
  const cols = serializePlacement(value);
  assert.deepEqual(cols, {
    placement_region: "forearm",
    placement_side: "left",
    placement_view: "front",
  });
  assert.deepEqual(parsePlacement(cols), value);
});

test("round-trips a non-lateral back placement", () => {
  const value: PlacementValue = { region: "upperBack", side: null, view: "back" };
  const cols = serializePlacement(value);
  assert.deepEqual(parsePlacement(cols), value);
});

test("serializing null clears all three columns", () => {
  assert.deepEqual(serializePlacement(null), {
    placement_region: null,
    placement_side: null,
    placement_view: null,
  });
});

test("parse is defensive against malformed / partial columns", () => {
  assert.equal(parsePlacement(null), null);
  assert.equal(parsePlacement({ placement_region: "not_a_region" }), null);
  // Non-lateral region with a stray side → side dropped.
  assert.deepEqual(parsePlacement({ placement_region: "chest", placement_side: "left" }), {
    region: "chest",
    side: null,
    view: "front",
  });
  // Missing view defaults to front.
  assert.equal(parsePlacement({ placement_region: "hand", placement_side: "right" })?.view, "front");
});

test("placementLabelFromColumns bridges storage to display", () => {
  assert.equal(
    placementLabelFromColumns({
      placement_region: "calf",
      placement_side: "right",
      placement_view: "back",
    }),
    "Right calf",
  );
  assert.equal(placementLabelFromColumns(null), null);
});

// --- <select> fallback + option encoding ------------------------------------
test("option value round-trips through encode/decode", () => {
  const v: PlacementValue = { region: "thigh", side: "right", view: "back" };
  const encoded = encodeOption(v);
  assert.equal(encoded, "thigh:right");
  assert.deepEqual(decodeOption(encoded, "back"), v);
});

test("non-lateral option encodes without a side segment", () => {
  assert.equal(encodeOption({ region: "stomach", side: null }), "stomach");
  assert.deepEqual(decodeOption("stomach", "front"), {
    region: "stomach",
    side: null,
    view: "front",
  });
});

test("front select options expand lateral regions to left+right and stay in catalog", () => {
  const opts = placementSelectOptions("front");
  const labels = opts.map((o) => o.label);
  assert.ok(labels.includes("Left forearm"));
  assert.ok(labels.includes("Right forearm"));
  assert.ok(labels.includes("Chest"));
  // Every option decodes back to a real region.
  for (const o of opts) {
    const decoded = decodeOption(o.value, "front");
    assert.ok(decoded && isRegionKey(decoded.region), `decodable: ${o.value}`);
  }
});

test("back select options include the catalog-only full back", () => {
  const labels = placementSelectOptions("back").map((o) => o.label);
  assert.ok(labels.includes("Full back"));
  assert.ok(labels.includes("Left calf"));
  assert.ok(!labels.includes("Chest")); // chest is front-only
});

// --- Geometry / figure integrity --------------------------------------------
test("every figure shape references a known region key", () => {
  for (const view of ["front", "back"] as const) {
    for (const rs of FIGURES[view].regions) {
      assert.ok(REGION_DEFS[rs.region], `${view}: ${rs.region} is a real region`);
      // Lateral regions must carry a side on the map; non-lateral must not.
      if (REGION_DEFS[rs.region].lateral) {
        assert.ok(rs.side === "left" || rs.side === "right", `${rs.region} has a side`);
      } else {
        assert.equal(rs.side, null, `${rs.region} has no side`);
      }
    }
  }
});

test("samePlacement compares region+side+view", () => {
  const a: PlacementValue = { region: "ribs", side: "left", view: "front" };
  assert.ok(samePlacement(a, { region: "ribs", side: "left", view: "front" }));
  assert.ok(!samePlacement(a, { region: "ribs", side: "right", view: "front" }));
  assert.ok(!samePlacement(a, null));
  assert.ok(samePlacement(null, null));
});
