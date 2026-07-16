// Offline unit tests for the branded email template renderer + Resend gate.
//   node --test supabase/functions/_shared/notification-email.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildActionUrl,
  isResendConfigured,
  renderNotificationEmail,
  resolveEmailFrom,
  sendResendEmail,
  DEFAULT_EMAIL_FROM,
  RESEND_API_URL,
} from "./notification-email.ts";

test("buildActionUrl: joins base + path, handles slashes", () => {
  assert.equal(buildActionUrl("https://getinkd.co", "/bookings/1"), "https://getinkd.co/bookings/1");
  assert.equal(buildActionUrl("https://getinkd.co/", "bookings/1"), "https://getinkd.co/bookings/1");
  assert.equal(buildActionUrl("https://getinkd.co", null), "https://getinkd.co");
});

test("renderNotificationEmail: subject is the title, body appears in html + text", () => {
  const out = renderNotificationEmail({
    category: "booking_request",
    title: "New booking request",
    body: "Mara Vance requested a booking — Poppy cluster, forearm, Jul 21",
    actionPath: "/bookings/requests/abc",
    appUrl: "https://getinkd.co",
    recipientName: "Ivy",
  });
  assert.equal(out.subject, "New booking request");
  assert.match(out.html, /Poppy cluster/);
  assert.match(out.text, /Poppy cluster/);
  assert.match(out.html, /Hi Ivy,/);
  assert.match(out.text, /Hi Ivy,/);
});

test("renderNotificationEmail: CTA label is category-specific + links absolute", () => {
  const req = renderNotificationEmail({
    category: "booking_request",
    title: "t",
    body: "b",
    actionPath: "/bookings/requests/abc",
    appUrl: "https://getinkd.co",
  });
  assert.match(req.html, /Review request/);
  assert.match(req.html, /https:\/\/getinkd\.co\/bookings\/requests\/abc/);
  assert.match(req.text, /Review request: https:\/\/getinkd\.co\/bookings\/requests\/abc/);

  const deposit = renderNotificationEmail({
    category: "deposit",
    title: "t",
    body: "b",
    actionPath: "/bookings/1",
    appUrl: "https://getinkd.co",
  });
  assert.match(deposit.html, /View receipt/);
});

test("renderNotificationEmail: no name -> generic greeting", () => {
  const out = renderNotificationEmail({
    category: "message",
    title: "New message",
    body: "You have a message",
    appUrl: "https://getinkd.co",
  });
  assert.match(out.html, /Hi,/);
});

test("renderNotificationEmail: escapes HTML in user-supplied content", () => {
  const out = renderNotificationEmail({
    category: "message",
    title: "Hi <script>alert(1)</script>",
    body: 'Tom & "Jerry" <b>bold</b>',
    appUrl: "https://getinkd.co",
    recipientName: "<img src=x>",
  });
  assert.doesNotMatch(out.html, /<script>/);
  assert.match(out.html, /&lt;script&gt;/);
  assert.match(out.html, /Tom &amp; &quot;Jerry&quot;/);
  assert.doesNotMatch(out.html, /<img src=x>/);
});

test("renderNotificationEmail: includes a preferences deep-link in the footer", () => {
  const out = renderNotificationEmail({
    category: "review",
    title: "t",
    body: "b",
    appUrl: "https://getinkd.co",
  });
  assert.match(out.html, /settings\?tab=notifications/);
  assert.match(out.text, /settings\?tab=notifications/);
});

test("isResendConfigured: true only with a non-empty key", () => {
  assert.equal(isResendConfigured(() => "re_123"), true);
  assert.equal(isResendConfigured(() => ""), false);
  assert.equal(isResendConfigured(() => undefined), false);
});

test("resolveEmailFrom: default + override", () => {
  assert.equal(resolveEmailFrom(() => undefined), DEFAULT_EMAIL_FROM);
  assert.equal(resolveEmailFrom(() => "INKD <hi@getinkd.co>"), "INKD <hi@getinkd.co>");
});

test("sendResendEmail: posts to Resend with bearer + returns id", async () => {
  let seenAuth = "";
  let seenBody: Record<string, unknown> = {};
  const fakeFetch = async (url: string, init: RequestInit) => {
    assert.equal(url, RESEND_API_URL);
    seenAuth = (init.headers as Record<string, string>).Authorization;
    seenBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
  };
  const { id } = await sendResendEmail(
    {
      apiKey: "re_secret",
      from: DEFAULT_EMAIL_FROM,
      to: "ivy@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    },
    fakeFetch as typeof fetch,
  );
  assert.equal(id, "email-1");
  assert.equal(seenAuth, "Bearer re_secret");
  assert.deepEqual(seenBody.to, ["ivy@example.com"]);
});

test("sendResendEmail: throws on non-2xx", async () => {
  const fakeFetch = async () => new Response("bad", { status: 422 });
  await assert.rejects(
    () =>
      sendResendEmail(
        { apiKey: "k", from: "f", to: "t@e.com", subject: "s", html: "h", text: "t" },
        fakeFetch as typeof fetch,
      ),
    /Resend send failed: 422/,
  );
});
