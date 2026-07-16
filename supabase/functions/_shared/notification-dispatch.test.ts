// Offline unit tests for the delivery dispatcher orchestration, with a fully
// faked repo + senders (no DB, no network).
//   node --test supabase/functions/_shared/notification-dispatch.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  processDeliveries,
  type DeliveryRow,
  type DispatchRepo,
  type NotificationRow,
  type Recipient,
} from "./notification-dispatch.ts";
import type { DeviceToken, SendPushResult } from "./expo-push.ts";

const TOK = "ExponentPushToken[abc]";

function makeNotification(over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "n1",
    type: "booking_request_new",
    title: "New booking request",
    body: "Mara Vance requested a booking — Poppy cluster, forearm, Jul 21",
    action_url: "/bookings/requests/abc",
    data: { booking_request_id: "abc" },
    ...over,
  };
}

interface FakeState {
  deliveries: DeliveryRow[];
  notification: NotificationRow | null;
  tokens: DeviceToken[];
  recipient: Recipient | null;
  unread: number;
  marks: { id: string; status: string; ref?: string | null; reason?: string }[];
  deletedTokens: string[];
}

function makeRepo(state: FakeState): DispatchRepo {
  return {
    leaseDeliveries: async () => state.deliveries,
    loadNotification: async () => state.notification,
    loadPushTokens: async () => state.tokens,
    loadRecipient: async () => state.recipient,
    unreadCount: async () => state.unread,
    markSent: async (id, ref) => {
      state.marks.push({ id, status: "sent", ref });
    },
    markSkipped: async (id, reason) => {
      state.marks.push({ id, status: "skipped", reason });
    },
    markFailed: async (id, error) => {
      state.marks.push({ id, status: "failed", reason: error });
    },
    deleteTokens: async (tokens) => {
      state.deletedTokens.push(...tokens);
    },
  };
}

const okPush = async (
  tokens: DeviceToken[],
  content: { title: string; body: string; data: Record<string, unknown>; badge: number },
): Promise<SendPushResult> => {
  // capture is done via closure in individual tests when needed
  void tokens;
  void content;
  return { tickets: [{ status: "ok", id: "ticket-1" }], invalidTokens: [], anyOk: true };
};

const okEmail = async () => ({ id: "email-1" });

test("push delivery: builds payload, sends, marks sent with ticket ref", async () => {
  let captured: { title: string; body: string; data: Record<string, unknown>; badge: number } | null =
    null;
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "push", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [{ token: TOK, platform: "ios" }],
    recipient: null,
    unread: 5,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: async (t, c) => {
      captured = c;
      return okPush(t, c);
    },
    sendEmail: okEmail,
    getEnv: () => undefined,
  });
  assert.equal(summary.sent, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(state.marks[0].status, "sent");
  assert.equal(state.marks[0].ref, "ticket-1");
  // Deep-link url + badge threaded into the push payload.
  assert.equal(captured!.badge, 5);
  assert.equal(captured!.data.url, "/bookings/requests/abc");
  assert.equal(captured!.data.notification_id, "n1");
  assert.equal(captured!.title, "New booking request");
});

test("push delivery: no tokens -> skipped(no_tokens)", async () => {
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "push", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [],
    recipient: null,
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: okPush,
    sendEmail: okEmail,
    getEnv: () => undefined,
  });
  assert.equal(summary.skipped, 1);
  assert.equal(state.marks[0].reason, "no_tokens");
});

test("push delivery: DeviceNotRegistered prunes token + skips", async () => {
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "push", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [{ token: TOK, platform: "ios" }],
    recipient: null,
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: async () => ({
      tickets: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
      invalidTokens: [TOK],
      anyOk: false,
    }),
    sendEmail: okEmail,
    getEnv: () => undefined,
  });
  assert.equal(summary.prunedTokens, 1);
  assert.equal(summary.skipped, 1);
  assert.deepEqual(state.deletedTokens, [TOK]);
  assert.equal(state.marks.at(-1)!.reason, "tokens_unregistered");
});

test("email delivery: RESEND not configured -> skipped(email_not_configured)", async () => {
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "email", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [],
    recipient: { email: "ivy@example.com", display_name: "Ivy" },
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: okPush,
    sendEmail: okEmail,
    getEnv: () => undefined, // RESEND_API_KEY absent
  });
  assert.equal(summary.skipped, 1);
  assert.equal(state.marks[0].reason, "email_not_configured");
});

test("email delivery: configured -> renders + sends + marks sent", async () => {
  let sentTo = "";
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "email", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [],
    recipient: { email: "ivy@example.com", display_name: "Ivy" },
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: okPush,
    sendEmail: async ({ to }) => {
      sentTo = to;
      return { id: "email-1" };
    },
    getEnv: (k) => (k === "RESEND_API_KEY" ? "re_123" : undefined),
  });
  assert.equal(summary.sent, 1);
  assert.equal(sentTo, "ivy@example.com");
  assert.equal(state.marks[0].ref, "email-1");
});

test("delivery: notification gone -> skipped", async () => {
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "push", attempts: 1, max_attempts: 3 },
    ],
    notification: null,
    tokens: [{ token: TOK, platform: "ios" }],
    recipient: null,
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: okPush,
    sendEmail: okEmail,
    getEnv: () => undefined,
  });
  assert.equal(summary.skipped, 1);
  assert.equal(state.marks[0].reason, "notification_gone");
});

test("delivery: sender throws -> marked failed", async () => {
  const state: FakeState = {
    deliveries: [
      { id: "d1", notification_id: "n1", user_id: "u1", channel: "push", attempts: 1, max_attempts: 3 },
    ],
    notification: makeNotification(),
    tokens: [{ token: TOK, platform: "ios" }],
    recipient: null,
    unread: 0,
    marks: [],
    deletedTokens: [],
  };
  const summary = await processDeliveries({
    repo: makeRepo(state),
    appUrl: "https://getinkd.co",
    sendPush: async () => {
      throw new Error("expo unreachable");
    },
    sendEmail: okEmail,
    getEnv: () => undefined,
  });
  assert.equal(summary.failed, 1);
  assert.equal(state.marks[0].status, "failed");
  assert.match(state.marks[0].reason ?? "", /expo unreachable/);
});
