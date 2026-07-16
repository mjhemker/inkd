// POST /functions/v1/send-email
//
// Standalone Resend email sender. Renders + sends a branded INKD notification
// email. notify-dispatch handles the queue path; this exists for direct/manual
// sends and for testing the email pipeline. Accepts either a rendered payload
// ({ to, subject, html, text }) or a notification payload
// ({ to, category, title, body, action_path?, recipient_name? }) that it renders
// with the shared template.
//
// AUTH: verify_jwt = false at the gateway (config.toml); enforces the shared
// AI-runtime bearer itself (server-to-server).
//
// GRACEFUL NO-OP: with no RESEND_API_KEY (or unverified domain) this returns
// 200 { ok:true, skipped:true, reason:"not_configured" } and sends nothing —
// never a 5xx. See docs/notifications.md for the founder setup.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { errorResponse, jsonResponse, errors } from "../_shared/errors.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { resolveAppUrl } from "../_shared/env.ts";
import {
  isResendConfigured,
  renderNotificationEmail,
  resolveEmailFrom,
  sendResendEmail,
} from "../_shared/notification-email.ts";
import {
  categoryForType,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "../_shared/notification-categories.ts";

interface SendEmailBody {
  to?: string;
  // Rendered path:
  subject?: string;
  html?: string;
  text?: string;
  // Template path:
  category?: string;
  type?: string;
  title?: string;
  body?: string;
  action_path?: string | null;
  recipient_name?: string | null;
}

function isCategory(v: string): v is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(v);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!isAuthorizedRunner(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = (await req.json()) as SendEmailBody;
    if (!body.to) throw errors.badRequest("`to` is required");

    // Graceful no-op — the founder hasn't wired Resend yet.
    if (!isResendConfigured()) {
      console.log("send-email: skipped (RESEND_API_KEY not set)");
      return jsonResponse({ ok: true, skipped: true, reason: "not_configured" });
    }

    let subject = body.subject;
    let html = body.html;
    let text = body.text;

    // Render from a notification payload when a full one wasn't provided.
    if (!subject || !html || !text) {
      if (!body.title || !body.body) {
        throw errors.badRequest(
          "provide {subject,html,text} or {title,body[,category]}",
        );
      }
      const category: NotificationCategory =
        (body.category && isCategory(body.category) && body.category) ||
        (body.type ? categoryForType(body.type) : null) ||
        "message";
      const rendered = renderNotificationEmail({
        category,
        title: body.title,
        body: body.body,
        actionPath: body.action_path ?? null,
        appUrl: resolveAppUrl(),
        recipientName: body.recipient_name ?? null,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    const { id } = await sendResendEmail({
      apiKey: Deno.env.get("RESEND_API_KEY") as string,
      from: resolveEmailFrom(),
      to: body.to,
      subject,
      html,
      text,
    });

    return jsonResponse({ ok: true, id });
  } catch (err) {
    console.error("send-email:", err);
    return errorResponse(err);
  }
});
