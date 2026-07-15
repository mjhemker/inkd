/** Presentation helpers for the notification bell + `/notifications` page.
 * `type` is the free-text discriminator written by the fan-out triggers in
 * `supabase/migrations/20260716050000_notification_triggers.sql`. */
import type { IconName } from "@inkd/ui/web";

export interface NotificationKindMeta {
  icon: IconName;
  label: string;
}

const KIND_META: Record<string, NotificationKindMeta> = {
  booking_request_new: { icon: "calendar", label: "Booking requests" },
  booking_request_accepted: { icon: "check", label: "Booking requests" },
  booking_request_declined: { icon: "x", label: "Booking requests" },
  session_scheduled: { icon: "calendar", label: "Sessions" },
  payment_deposit_received: { icon: "credit-card", label: "Payments" },
  review_new: { icon: "star", label: "Reviews" },
  review_response: { icon: "star", label: "Reviews" },
  message_new: { icon: "message-circle", label: "Messages" },
};

const DEFAULT_META: NotificationKindMeta = { icon: "bell", label: "Other" };

export function notificationKindMeta(type: string): NotificationKindMeta {
  return KIND_META[type] ?? DEFAULT_META;
}

/** Distinct filter options for the `/notifications` page, in a stable order. */
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
