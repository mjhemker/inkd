// Offline unit tests for the pure mobile nav + deep-link mapping. No renderer,
// no expo-router — just the path-rewrite contract that keeps notification taps
// landing inside the Studio tab (tab bar visible).
//
//   node --test apps/mobile/lib/nav.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDeepLink,
  visibleTabLabels,
  STUDIO_SECTIONS,
  HUB_TAB_ROUTES,
} from "./nav.ts";

test("Inbox has its own middle slot for both roles; artists add Studio", () => {
  // Clients: four tabs, Inbox in slot 3.
  assert.deepEqual(visibleTabLabels(false), ["Home", "Discover", "Inbox", "Profile"]);
  // Artists: same four + Studio in the fifth slot. Inbox is NOT swapped out.
  assert.deepEqual(visibleTabLabels(true), ["Home", "Discover", "Inbox", "Profile", "Studio"]);
  assert.equal(visibleTabLabels(true).includes("Inbox"), true);
  assert.equal(visibleTabLabels(true)[2], "Inbox");
  assert.equal(visibleTabLabels(false)[2], "Inbox");
  assert.equal(visibleTabLabels(true)[1], "Discover");
  assert.equal(visibleTabLabels(false)[1], "Discover");
  // The old "Messages" label is retired in favor of "Inbox".
  assert.equal(visibleTabLabels(false).includes("Messages"), false);
  assert.equal(visibleTabLabels(true).includes("Messages"), false);
});

test("studio hub keeps exactly the five persistent surfaces", () => {
  assert.deepEqual(HUB_TAB_ROUTES, ["index", "discover", "messages", "profile", "studio"]);
});

test("studio has four internal sections landing on the dashboard", () => {
  assert.deepEqual(
    STUDIO_SECTIONS.map((s) => s.value),
    ["dashboard", "bookings", "ai", "settings"],
  );
  assert.equal(STUDIO_SECTIONS[0].route, "/studio");
});

test("every studio section carries a one-line snippet for the header", () => {
  for (const section of STUDIO_SECTIONS) {
    assert.equal(typeof section.snippet, "string");
    assert.ok(section.snippet.length > 0, `${section.value} needs a snippet`);
  }
});

test("legacy /dashboard normalizes into the Studio tab", () => {
  assert.equal(normalizeDeepLink("/dashboard"), "/studio");
});

test("legacy /settings normalizes into the Studio tab, preserving ?tab=", () => {
  assert.equal(normalizeDeepLink("/settings"), "/studio/settings");
  assert.equal(normalizeDeepLink("/settings?tab=shop"), "/studio/settings?tab=shop");
  assert.equal(normalizeDeepLink("/settings?tab=ai&x=1"), "/studio/settings?tab=ai&x=1");
});

test("already-in-tab studio paths pass through untouched", () => {
  assert.equal(normalizeDeepLink("/studio"), "/studio");
  assert.equal(normalizeDeepLink("/studio/ai?tab=activity&action=abc"), "/studio/ai?tab=activity&action=abc");
  assert.equal(normalizeDeepLink("/studio/shop"), "/studio/shop");
});

test("detail / non-studio paths pass through untouched", () => {
  assert.equal(normalizeDeepLink("/bookings/123"), "/bookings/123");
  assert.equal(normalizeDeepLink("/bookings/requests/abc"), "/bookings/requests/abc");
  assert.equal(normalizeDeepLink("/bookings/waitlist"), "/bookings/waitlist");
  assert.equal(normalizeDeepLink("/daily-drop"), "/daily-drop");
  assert.equal(normalizeDeepLink("/notifications"), "/notifications");
});

test("non-absolute or unexpected input is returned as-is", () => {
  assert.equal(normalizeDeepLink("settings"), "settings");
  assert.equal(normalizeDeepLink(""), "");
});
