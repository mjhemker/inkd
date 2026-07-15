/** Presentation helpers for the notification bell + `/notifications` screen.
 * Mirrors `apps/web/src/lib/notifications.ts` — keep the two in sync. `type`
 * is the free-text discriminator written by the fan-out triggers in
 * `supabase/migrations/20260716050000_notification_triggers.sql`. */
import type { IconName } from "@inkd/ui/native";

export interface NotificationKindMeta {
  icon: IconName;
  label: string;
}

const KIND_META: Record<string, NotificationKindMeta> = {
  booking_request_new: { icon: "calendar", label: "Requests" },
  booking_request_accepted: { icon: "check", label: "Accepted" },
  booking_request_declined: { icon: "x", label: "Declined" },
  session_scheduled: { icon: "calendar", label: "Sessions" },
  payment_deposit_received: { icon: "credit-card", label: "Deposits" },
  review_new: { icon: "star", label: "Reviews" },
  review_response: { icon: "star", label: "Responses" },
  message_new: { icon: "message-circle", label: "Messages" },
};

const DEFAULT_META: NotificationKindMeta = { icon: "bell", label: "Other" };

export function notificationKindMeta(type: string): NotificationKindMeta {
  return KIND_META[type] ?? DEFAULT_META;
}

/** Distinct filter options for the notifications screen, in a stable order. */
export const NOTIFICATION_FILTER_TYPES = [
  "booking_request_new",
  "booking_request_accepted",
  "booking_request_declined",
  "session_scheduled",
  "payment_deposit_received",
  "review_new",
  "review_response",
  "message_new",
] as const;
