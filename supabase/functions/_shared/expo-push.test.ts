// Offline unit tests for the Expo push payload builder + ticket reconciliation.
//   node --test supabase/functions/_shared/expo-push.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildExpoPushMessages,
  chunkMessages,
  isExpoPushToken,
  sendExpoPush,
  EXPO_PUSH_URL,
  type DeviceToken,
  type ExpoPushMessage,
} from "./expo-push.ts";

const TOK = (n: number) => `ExponentPushToken[token-${n}]`;

test("isExpoPushToken accepts Exponent/Expo tokens, rejects junk", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc]"), true);
  assert.equal(isExpoPushToken("not-a-token"), false);
  assert.equal(isExpoPushToken(""), false);
});

test("buildExpoPushMessages: one message per valid token with correct shape", () => {
  const tokens: DeviceToken[] = [
    { token: TOK(1), platform: "ios" },
    { token: TOK(2), platform: "android" },
  ];
  const msgs = buildExpoPushMessages(tokens, {
    title: "New booking request",
    body: "Mara Vance requested a booking — Poppy cluster, forearm, Jul 21",
    data: { url: "/bookings/requests/abc", notification_id: "n1" },
    badge: 3,
  });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].to, TOK(1));
  assert.equal(msgs[0].title, "New booking request");
  assert.equal(msgs[0].body.includes("Poppy cluster"), true);
  assert.equal(msgs[0].sound, "default");
  assert.equal(msgs[0].priority, "high");
  assert.equal(msgs[0].channelId, "default");
  assert.equal(msgs[0].badge, 3);
  assert.deepEqual(msgs[0].data, { url: "/bookings/requests/abc", notification_id: "n1" });
});

test("buildExpoPushMessages: drops invalid tokens and trims text", () => {
  const msgs = buildExpoPushMessages(
    [
      { token: TOK(1), platform: "ios" },
      { token: "garbage", platform: "ios" },
    ],
    { title: "  Hi  ", body: "  there  " },
  );
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].title, "Hi");
  assert.equal(msgs[0].body, "there");
});

test("buildExpoPushMessages: omits badge when unset", () => {
  const [msg] = buildExpoPushMessages([{ token: TOK(1), platform: "android" }], {
    title: "t",
    body: "b",
  });
  assert.equal("badge" in msg, false);
});

test("chunkMessages: splits into <=100 per chunk", () => {
  const many: ExpoPushMessage[] = Array.from({ length: 250 }, (_, i) => ({
    to: TOK(i),
    title: "t",
    body: "b",
    data: {},
    sound: "default",
    priority: "high",
    channelId: "default",
  }));
  const chunks = chunkMessages(many);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[2].length, 50);
});

test("sendExpoPush: posts to Expo and surfaces ok tickets", async () => {
  let sentBody: unknown = null;
  const fakeFetch = async (url: string, init: RequestInit) => {
    assert.equal(url, EXPO_PUSH_URL);
    sentBody = JSON.parse(init.body as string);
    return new Response(
      JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }),
      { status: 200 },
    );
  };
  const msgs = buildExpoPushMessages([{ token: TOK(1), platform: "ios" }], {
    title: "t",
    body: "b",
  });
  const result = await sendExpoPush(msgs, fakeFetch as typeof fetch);
  assert.equal(result.anyOk, true);
  assert.equal(result.tickets[0].id, "ticket-1");
  assert.equal(result.invalidTokens.length, 0);
  assert.equal(Array.isArray(sentBody), true);
});

test("sendExpoPush: reconciles DeviceNotRegistered -> invalidTokens for pruning", async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        data: [
          { status: "ok", id: "t-ok" },
          {
            status: "error",
            message: "not registered",
            details: { error: "DeviceNotRegistered" },
          },
        ],
      }),
      { status: 200 },
    );
  const msgs = buildExpoPushMessages(
    [
      { token: TOK(1), platform: "ios" },
      { token: TOK(2), platform: "android" },
    ],
    { title: "t", body: "b" },
  );
  const result = await sendExpoPush(msgs, fakeFetch as typeof fetch);
  assert.equal(result.anyOk, true);
  assert.deepEqual(result.invalidTokens, [TOK(2)]);
});

test("sendExpoPush: throws on non-2xx from Expo", async () => {
  const fakeFetch = async () => new Response("boom", { status: 500 });
  const msgs = buildExpoPushMessages([{ token: TOK(1), platform: "ios" }], {
    title: "t",
    body: "b",
  });
  await assert.rejects(() => sendExpoPush(msgs, fakeFetch as typeof fetch), /Expo push failed: 500/);
});
