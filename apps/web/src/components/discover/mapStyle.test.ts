// Unit tests for the discovery map's style resolution + Mapbox URL rewriting.
// Runs under Node's built-in runner with type-stripping:
//   node --test apps/web/src/components/discover/mapStyle.test.ts
// The sandbox can't render tiles, so these pin the pure decisions the runtime
// fallback machine depends on: which style is tried first, and that a pasted
// Mapbox token "just works" by rewriting every mapbox:// resource shape.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveMapStyles,
  rewriteMapboxUrl,
  makeMapboxTransformRequest,
  OPENFREEMAP_LIBERTY,
  OPENFREEMAP_POSITRON,
  DEFAULT_MAPBOX_STYLE,
} from "./mapStyle.ts";

test("resolveMapStyles: default (no env) = liberty -> positron", () => {
  const c = resolveMapStyles({});
  assert.deepEqual(c.map((s) => s.id), ["openfreemap-liberty", "openfreemap-positron"]);
  assert.equal(c[0]!.url, OPENFREEMAP_LIBERTY);
  assert.equal(c[1]!.url, OPENFREEMAP_POSITRON);
  assert.equal(c[0]!.transformRequest, undefined);
});

test("resolveMapStyles: explicit HTTP override wins, keyless fallbacks retained", () => {
  const url = "https://api.maptiler.com/maps/streets-v2/style.json?key=ABC123";
  const c = resolveMapStyles({ styleUrl: url });
  assert.equal(c[0]!.id, "override");
  assert.equal(c[0]!.url, url);
  assert.equal(c[0]!.transformRequest, undefined, "http override needs no transform");
  assert.deepEqual(c.slice(1).map((s) => s.id), ["openfreemap-liberty", "openfreemap-positron"]);
});

test("resolveMapStyles: token (no explicit url) => mapbox dark first, with transform", () => {
  const c = resolveMapStyles({ mapboxToken: "pk.testtoken" });
  assert.equal(c[0]!.id, "mapbox");
  assert.equal(c[0]!.url, DEFAULT_MAPBOX_STYLE);
  assert.equal(typeof c[0]!.transformRequest, "function");
});

test("resolveMapStyles: mapbox:// override + token gets the transform wired", () => {
  const c = resolveMapStyles({
    styleUrl: "mapbox://styles/acme/clabc123",
    mapboxToken: "pk.tok",
  });
  assert.equal(c[0]!.id, "override");
  assert.equal(typeof c[0]!.transformRequest, "function");
});

test("resolveMapStyles: blank/whitespace env is ignored", () => {
  const c = resolveMapStyles({ styleUrl: "   ", mapboxToken: "  " });
  assert.deepEqual(c.map((s) => s.id), ["openfreemap-liberty", "openfreemap-positron"]);
});

test("rewriteMapboxUrl: style JSON", () => {
  assert.equal(
    rewriteMapboxUrl("mapbox://styles/mapbox/dark-v11", "TK"),
    "https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=TK",
  );
});

test("rewriteMapboxUrl: sprite json / png / @2x", () => {
  assert.equal(
    rewriteMapboxUrl("mapbox://sprites/mapbox/dark-v11.json", "TK"),
    "https://api.mapbox.com/styles/v1/mapbox/dark-v11/sprite.json?access_token=TK",
  );
  assert.equal(
    rewriteMapboxUrl("mapbox://sprites/mapbox/dark-v11@2x.png", "TK"),
    "https://api.mapbox.com/styles/v1/mapbox/dark-v11/sprite@2x.png?access_token=TK",
  );
});

test("rewriteMapboxUrl: glyph fonts", () => {
  assert.equal(
    rewriteMapboxUrl("mapbox://fonts/mapbox/{fontstack}/{range}.pbf", "TK"),
    "https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=TK",
  );
});

test("rewriteMapboxUrl: tileset id -> TileJSON", () => {
  assert.equal(
    rewriteMapboxUrl("mapbox://mapbox.mapbox-streets-v8", "TK"),
    "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=TK&secure",
  );
});

test("makeMapboxTransformRequest: passes through non-mapbox URLs untouched", () => {
  const tr = makeMapboxTransformRequest("TK");
  assert.deepEqual(tr("https://tiles.openfreemap.org/styles/liberty"), {
    url: "https://tiles.openfreemap.org/styles/liberty",
  });
  assert.deepEqual(tr("mapbox://styles/mapbox/dark-v11"), {
    url: "https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=TK",
  });
});
