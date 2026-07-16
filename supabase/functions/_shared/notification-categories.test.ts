// Offline unit tests for the fan-out prefs resolver + category map. Runs with
// zero dependencies under Node's built-in runner (type-stripping):
//   node --test supabase/functions/_shared/notification-categories.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  categoryForType,
  defaultChannels,
  resolveChannels,
  NOTIFICATION_CATEGORIES,
} from "./notification-categories.ts";

test("categoryForType maps every trigger type to a category", () => {
  assert.equal(categoryForType("booking_request_new"), "booking_request");
  assert.equal(categoryForType("booking_request_accepted"), "booking_accepted");
  assert.equal(categoryForType("booking_request_declined"), "booking_declined");
  assert.equal(categoryForType("session_scheduled"), "session_reminder");
  assert.equal(categoryForType("payment_deposit_received"), "deposit");
  assert.equal(categoryForType("message_new"), "message");
  assert.equal(categoryForType("review_new"), "review");
  assert.equal(categoryForType("review_response"), "review_response");
});

test("categoryForType returns null for unknown types (in-app only)", () => {
  assert.equal(categoryForType("something_else"), null);
  assert.equal(categoryForType(""), null);
});

test("defaultChannels: push + in_app always ON", () => {
  for (const c of NOTIFICATION_CATEGORIES) {
    const d = defaultChannels(c);
    assert.equal(d.in_app, true, `${c} in_app`);
    assert.equal(d.push, true, `${c} push`);
  }
});

test("defaultChannels: email ON only for high-value categories", () => {
  const onByDefault = [
    "booking_request",
    "booking_accepted",
    "booking_declined",
    "session_reminder",
    "deposit",
  ] as const;
  const offByDefault = [
    "message",
    "review",
    "review_response",
    "ai_approval",
    "aftercare",
  ] as const;
  for (const c of onByDefault) assert.equal(defaultChannels(c).email, true, `${c}`);
  for (const c of offByDefault) assert.equal(defaultChannels(c).email, false, `${c}`);
});

test("resolveChannels: no stored prefs -> category defaults", () => {
  const r = resolveChannels("payment_deposit_received", null);
  assert.deepEqual(r, {
    category: "deposit",
    in_app: true,
    push: true,
    email: true, // deposit defaults email on
  });
});

test("resolveChannels: message defaults email off", () => {
  const r = resolveChannels("message_new", null);
  assert.equal(r?.email, false);
  assert.equal(r?.push, true);
});

test("resolveChannels: stored prefs override per channel", () => {
  // User turned push off for deposits but left email default (on).
  const r = resolveChannels("payment_deposit_received", { push: false });
  assert.equal(r?.push, false);
  assert.equal(r?.email, true);
  assert.equal(r?.in_app, true);
});

test("resolveChannels: stored can turn a defaulted-off channel on", () => {
  const r = resolveChannels("message_new", { email: true });
  assert.equal(r?.email, true);
});

test("resolveChannels: uncategorized type -> null (no push/email fan-out)", () => {
  assert.equal(resolveChannels("mystery_event", { push: true }), null);
});
