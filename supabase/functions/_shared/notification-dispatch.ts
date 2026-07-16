// The notification delivery dispatcher (the brain behind the notify-dispatch
// edge function). Leases pending notification_deliveries rows, loads the source
// notification + the recipient's tokens/email, sends over the right channel,
// marks the row sent/skipped/failed, and prunes dead push tokens.
//
// All IO is behind the DispatchRepo interface and the two sender callbacks, so
// this orchestration is fully unit-tested offline with fakes (no network, no DB).

import {
  buildExpoPushMessages,
  type DeviceToken,
  type SendPushResult,
} from "./expo-push.ts";
import {
  buildActionUrl,
  isResendConfigured,
  renderNotificationEmail,
} from "./notification-email.ts";
import { categoryForType } from "./notification-categories.ts";

export interface DeliveryRow {
  id: string;
  notification_id: string;
  user_id: string;
  channel: "push" | "email";
  attempts: number;
  max_attempts: number;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  action_url: string | null;
  data: Record<string, unknown> | null;
}

export interface Recipient {
  email: string | null;
  display_name: string | null;
}

export interface DispatchRepo {
  leaseDeliveries(limit: number): Promise<DeliveryRow[]>;
  loadNotification(id: string): Promise<NotificationRow | null>;
  loadPushTokens(userId: string): Promise<DeviceToken[]>;
  loadRecipient(userId: string): Promise<Recipient | null>;
  /** Unread in-app count -> the iOS app-icon badge number. */
  unreadCount(userId: string): Promise<number>;
  markSent(id: string, providerRef: string | null): Promise<void>;
  markSkipped(id: string, reason: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  /** Delete DeviceNotRegistered tokens so we stop delivering to them. */
  deleteTokens(tokens: string[]): Promise<void>;
}

/** Injected sender for push (real one wraps sendExpoPush; tests fake it). */
export type PushSender = (
  tokens: DeviceToken[],
  content: { title: string; body: string; data: Record<string, unknown>; badge: number },
) => Promise<SendPushResult>;

/** Injected sender for email (real one wraps sendResendEmail; tests fake it). */
export type EmailSender = (params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<{ id: string }>;

export interface DispatchDeps {
  repo: DispatchRepo;
  sendPush: PushSender;
  sendEmail: EmailSender;
  appUrl: string;
  /** Injectable so tests control the RESEND_API_KEY gate; defaults to env. */
  getEnv?: (k: string) => string | undefined;
}

export interface DispatchSummary {
  leased: number;
  sent: number;
  skipped: number;
  failed: number;
  prunedTokens: number;
}

/** A safe title/body for a notification, with fallbacks if a trigger ever wrote
 * an empty one. */
function contentFor(n: NotificationRow): { title: string; body: string } {
  const title = (n.title ?? "").trim() || "INKD";
  const body = (n.body ?? "").trim() || "You have a new notification on INKD.";
  return { title, body };
}

export async function processDeliveries(
  deps: DispatchDeps,
  limit = 20,
): Promise<DispatchSummary> {
  const { repo, sendPush, sendEmail, appUrl } = deps;
  const getEnv = deps.getEnv ?? ((k: string) => Deno.env.get(k));
  const deliveries = await repo.leaseDeliveries(limit);
  const summary: DispatchSummary = {
    leased: deliveries.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    prunedTokens: 0,
  };

  for (const d of deliveries) {
    try {
      const notification = await repo.loadNotification(d.notification_id);
      if (!notification) {
        await repo.markSkipped(d.id, "notification_gone");
        summary.skipped++;
        continue;
      }
      const { title, body } = contentFor(notification);

      if (d.channel === "push") {
        const tokens = await repo.loadPushTokens(d.user_id);
        if (tokens.length === 0) {
          await repo.markSkipped(d.id, "no_tokens");
          summary.skipped++;
          continue;
        }
        const badge = await repo.unreadCount(d.user_id);
        const result = await sendPush(tokens, {
          title,
          body,
          data: {
            notification_id: notification.id,
            type: notification.type,
            url: notification.action_url ?? null,
            ...(notification.data ?? {}),
          },
          badge,
        });
        if (result.invalidTokens.length > 0) {
          await repo.deleteTokens(result.invalidTokens);
          summary.prunedTokens += result.invalidTokens.length;
        }
        if (result.anyOk) {
          const ref = result.tickets.find((t) => t.status === "ok")?.id ?? null;
          await repo.markSent(d.id, ref);
          summary.sent++;
        } else {
          // Every ticket errored. If the only problem was dead tokens, treat it
          // as skipped (nothing to retry); otherwise fail + re-queue.
          const onlyDeadTokens =
            result.tickets.length > 0 &&
            result.tickets.every(
              (t) => t.status === "error" && t.details?.error === "DeviceNotRegistered",
            );
          if (onlyDeadTokens) {
            await repo.markSkipped(d.id, "tokens_unregistered");
            summary.skipped++;
          } else {
            const msg = result.tickets.find((t) => t.status === "error")?.message ??
              "expo push returned no successful tickets";
            await repo.markFailed(d.id, msg);
            summary.failed++;
          }
        }
        continue;
      }

      // channel === "email"
      if (!isResendConfigured(getEnv)) {
        // Graceful no-op until RESEND_API_KEY is set (docs/notifications.md).
        console.log(
          `notify-dispatch: email skipped (RESEND_API_KEY not set) delivery=${d.id}`,
        );
        await repo.markSkipped(d.id, "email_not_configured");
        summary.skipped++;
        continue;
      }
      const recipient = await repo.loadRecipient(d.user_id);
      if (!recipient?.email) {
        await repo.markSkipped(d.id, "no_email");
        summary.skipped++;
        continue;
      }
      const category = categoryForType(notification.type);
      if (!category) {
        await repo.markSkipped(d.id, "uncategorized");
        summary.skipped++;
        continue;
      }
      const rendered = renderNotificationEmail({
        category,
        title,
        body,
        actionPath: notification.action_url,
        appUrl,
        recipientName: recipient.display_name,
      });
      const { id } = await sendEmail({
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await repo.markSent(d.id, id || null);
      summary.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await repo.markFailed(d.id, msg);
      summary.failed++;
    }
  }

  return summary;
}

/** Convenience re-export so the edge function can build the absolute deep link
 * for logging without re-importing the email module. */
export { buildActionUrl, buildExpoPushMessages };
