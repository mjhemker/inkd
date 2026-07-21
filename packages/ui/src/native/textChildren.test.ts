// Offline unit tests for the primitive-level "Text strings must be rendered
// within a <Text>" crash guard shared by native Badge / Chip / Button. No
// renderer, no react-native — just the pure classify + wrap contract.
//
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     packages/ui/src/native/textChildren.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

import { isBareTextChild, wrapTextChildren } from "./textChildren.ts";

test("isBareTextChild flags the exact node types RN crashes on", () => {
  // Strings and numbers must be wrapped.
  assert.equal(isBareTextChild("hello"), true);
  assert.equal(isBareTextChild(""), true);
  assert.equal(isBareTextChild(0), true);
  assert.equal(isBareTextChild(42), true);
  assert.equal(isBareTextChild(-1.5), true);
});

test("isBareTextChild passes real elements + empty nodes through", () => {
  assert.equal(isBareTextChild(createElement("View")), false);
  assert.equal(isBareTextChild(null), false);
  assert.equal(isBareTextChild(undefined), false);
  assert.equal(isBareTextChild(true), false);
  assert.equal(isBareTextChild(false), false);
});

function typesOf(out: ReactNode): unknown[] {
  const arr = Array.isArray(out) ? out : out == null ? [] : [out];
  return arr.map((n) =>
    n && typeof n === "object" && "type" in n ? (n as { type: unknown }).type : n,
  );
}

test("wrapTextChildren wraps a lone string child", () => {
  const out = wrapTextChildren("Accepting new clients", (c, key) =>
    createElement("Text", { key }, c),
  );
  assert.deepEqual(typesOf(out), ["Text"]);
});

test("wrapTextChildren wraps a lone number child (previously unhandled)", () => {
  const out = wrapTextChildren(3, (c, key) => createElement("Text", { key }, c));
  assert.deepEqual(typesOf(out), ["Text"]);
});

test("wrapTextChildren wraps EACH string of an array child — the @ {name} crash", () => {
  // JSX `@ {badge.name}` is handed to the component as ["@ ", name]; the old
  // `typeof children === "string"` check saw an array and leaked raw strings
  // into the <View>. Every string part must now be wrapped.
  const out = wrapTextChildren(["@ ", "marla"], (c, key) =>
    createElement("Text", { key }, c),
  );
  assert.deepEqual(typesOf(out), ["Text", "Text"]);
});

test("wrapTextChildren passes elements through untouched, wraps interleaved text", () => {
  const pip = createElement("View", { key: "pip" });
  const out = wrapTextChildren([pip, " 4.9 · 12 reviews"], (c, key) =>
    createElement("Text", { key }, c),
  );
  // View stays a View; the trailing string becomes a Text.
  assert.deepEqual(typesOf(out), ["View", "Text"]);
});
