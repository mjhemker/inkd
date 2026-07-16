// Email delivery via Resend (FREE tier: 3k emails/mo, 100/day). Pure template
// renderer + a thin sender with an injectable fetch so the HTML/text output is
// unit-tested offline.
//
// GRACEFUL NO-OP: until Michael sets RESEND_API_KEY and verifies the getinkd.co
// domain in Resend (see docs/notifications.md), `isResendConfigured()` is false
// and the dispatcher marks email deliveries `skipped` with a logged reason —
// never an error. Nothing here throws just because the key is missing.

import type { NotificationCategory } from "./notification-categories.ts";

export const RESEND_API_URL = "https://api.resend.com/emails";
/** Default From. The domain (getinkd.co) MUST be verified in Resend first. */
export const DEFAULT_EMAIL_FROM = "INKD <notifications@getinkd.co>";

/** True only when a Resend API key is present. Gates every send. Never throws. */
export function isResendConfigured(
  getEnv: (k: string) => string | undefined = (k) => Deno.env.get(k),
): boolean {
  const key = getEnv("RESEND_API_KEY");
  return Boolean(key && key.trim() !== "");
}

/** Resolve the From address (RESEND_FROM override, else the default). */
export function resolveEmailFrom(
  getEnv: (k: string) => string | undefined = (k) => Deno.env.get(k),
): string {
  const v = getEnv("RESEND_FROM");
  return v && v.trim() !== "" ? v.trim() : DEFAULT_EMAIL_FROM;
}

/** Per-category call-to-action label for the email button. */
const CTA_LABEL: Record<NotificationCategory, string> = {
  booking_request: "Review request",
  booking_accepted: "View booking",
  booking_declined: "Find another artist",
  session_reminder: "View session",
  deposit: "View receipt",
  message: "Open conversation",
  review: "Read review",
  review_response: "View response",
  ai_approval: "Review & approve",
  aftercare: "View aftercare",
};

export interface EmailInput {
  category: NotificationCategory;
  /** The notification title — becomes the subject + headline. */
  title: string;
  /** The informative body line (who + what + detail). */
  body: string;
  /** The deep-link path (notification.action_url), e.g. "/bookings/123". */
  actionPath?: string | null;
  /** Base app URL (INKD_APP_URL), for building an absolute CTA link. */
  appUrl: string;
  /** Recipient display name for the greeting. */
  recipientName?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Join the app base URL and a deep-link path into one absolute URL. */
export function buildActionUrl(appUrl: string, actionPath?: string | null): string {
  const base = appUrl.replace(/\/+$/, "");
  if (!actionPath) return base;
  const path = actionPath.startsWith("/") ? actionPath : `/${actionPath}`;
  return `${base}${path}`;
}

/**
 * Render a branded INKD notification email. Dark "gallery placard" styling, but
 * email-safe: a table layout with fully INLINE CSS (no <style>, no flexbox, no
 * external assets) so it renders in Gmail / Apple Mail / Outlook. Returns the
 * subject, HTML, and a plain-text fallback.
 */
export function renderNotificationEmail(input: EmailInput): RenderedEmail {
  const subject = input.title;
  const ctaLabel = CTA_LABEL[input.category] ?? "Open INKD";
  const ctaUrl = buildActionUrl(input.appUrl, input.actionPath);
  const greetingName = input.recipientName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";

  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body);
  const greetingSafe = escapeHtml(greeting);
  const ctaLabelSafe = escapeHtml(ctaLabel);
  const ctaUrlSafe = escapeHtml(ctaUrl);

  // Colors mirror the INKD dark theme (surface #0A0A0B, ember/violet accent
  // #7C3AED, ink text). Kept inline for mail-client compatibility.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark light" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0B;">
<!-- preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0A0A0B;">${body}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0B;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background-color:#141416;border:1px solid #26262b;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <div style="font-family:'Georgia',serif;font-size:20px;font-weight:800;letter-spacing:0.14em;color:#FAFAFA;text-transform:uppercase;">INKD</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <div style="height:1px;background-color:#26262b;line-height:1px;font-size:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 4px 32px;">
            <p style="margin:0 0 14px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#A1A1AA;">${greetingSafe}</p>
            <h1 style="margin:0 0 10px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:700;color:#FAFAFA;">${title}</h1>
            <p style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#D4D4D8;">${body}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 30px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#7C3AED" style="border-radius:10px;">
                  <a href="${ctaUrlSafe}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${ctaLabelSafe}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;">
        <tr>
          <td style="padding:18px 32px;">
            <p style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#71717A;">
              You're receiving this because of your INKD notification settings.
              Manage what INKD emails you in <a href="${escapeHtml(buildActionUrl(input.appUrl, "/settings?tab=notifications"))}" target="_blank" style="color:#A78BFA;text-decoration:underline;">notification preferences</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    greeting,
    "",
    input.title,
    "",
    input.body,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "—",
    "You're receiving this because of your INKD notification settings.",
    `Manage preferences: ${buildActionUrl(input.appUrl, "/settings?tab=notifications")}`,
  ].join("\n");

  return { subject, html, text };
}

export interface SendEmailParams {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** POST a rendered email to Resend. Returns the provider message id. Throws on
 * a non-2xx so the dispatcher can mark the delivery failed + re-queue. */
export async function sendResendEmail(
  params: SendEmailParams,
  fetchImpl: FetchLike = ((...a: Parameters<typeof fetch>) => fetch(...a)) as FetchLike,
): Promise<{ id: string }> {
  const res = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id?: string };
  return { id: json.id ?? "" };
}
