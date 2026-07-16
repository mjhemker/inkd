/**
 * Notification preference categories — the app-facing source of truth for the
 * Settings > Notifications UI. The category set, the type->category map, and the
 * per-channel defaults MUST match:
 *   - SQL: public.notification_category_for_type / notification_category_default_email
 *          (migration 20260717060000_notification_delivery.sql)
 *   - Edge: supabase/functions/_shared/notification-categories.ts
 * Keep all three in sync when adding a category.
 */

export const NOTIFICATION_CATEGORIES = [
  "booking_request",
  "booking_accepted",
  "booking_declined",
  "session_reminder",
  "deposit",
  "message",
  "review",
  "review_response",
  "ai_approval",
  "aftercare",
  "waitlist",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationChannel = "in_app" | "push" | "email";

export interface ChannelPrefs {
  in_app: boolean;
  push: boolean;
  email: boolean;
}

export interface NotificationCategoryMeta {
  category: NotificationCategory;
  label: string;
  description: string;
  /** Whether this event even applies to clients / artists (both, here). */
  defaults: ChannelPrefs;
}

/** Categories whose EMAIL channel defaults ON — high-value transactional only. */
const EMAIL_DEFAULT_ON: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "booking_request",
  "booking_accepted",
  "booking_declined",
  "session_reminder",
  "deposit",
]);

export function defaultChannels(category: NotificationCategory): ChannelPrefs {
  return { in_app: true, push: true, email: EMAIL_DEFAULT_ON.has(category) };
}

/** Ordered, human-labelled metadata for the preferences UI. */
export const NOTIFICATION_CATEGORY_META: NotificationCategoryMeta[] =
  NOTIFICATION_CATEGORIES.map((category) => {
    const meta: Record<NotificationCategory, { label: string; description: string }> = {
      booking_request: {
        label: "Booking requests",
        description: "A client asks to book you.",
      },
      booking_accepted: {
        label: "Booking accepted",
        description: "An artist accepts your request.",
      },
      booking_declined: {
        label: "Booking declined",
        description: "An artist declines your request.",
      },
      session_reminder: {
        label: "Session updates",
        description: "A session is scheduled or updated.",
      },
      deposit: {
        label: "Deposits & payments",
        description: "A deposit is received or due.",
      },
      message: {
        label: "Messages",
        description: "New chat messages from clients or artists.",
      },
      review: {
        label: "Reviews",
        description: "A client leaves you a review.",
      },
      review_response: {
        label: "Review replies",
        description: "An artist replies to your review.",
      },
      ai_approval: {
        label: "AI staff approvals",
        description: "Your AI staff needs your sign-off.",
      },
      aftercare: {
        label: "Aftercare",
        description: "Aftercare check-ins after a session.",
      },
      waitlist: {
        label: "Waitlist offers",
        description: "A spot opens up on a waitlist you joined.",
      },
    };
    return { category, ...meta[category], defaults: defaultChannels(category) };
  });

/** Map a raw notification `type` to its preference category (null = in-app only). */
export function categoryForType(type: string): NotificationCategory | null {
  switch (type) {
    case "booking_request_new":
      return "booking_request";
    case "booking_request_accepted":
      return "booking_accepted";
    case "booking_request_declined":
      return "booking_declined";
    case "session_scheduled":
      return "session_reminder";
    case "payment_deposit_received":
      return "deposit";
    case "message_new":
      return "message";
    case "review_new":
      return "review";
    case "review_response":
      return "review_response";
    case "ai_approval_needed":
      return "ai_approval";
    case "aftercare_check_in":
      return "aftercare";
    case "waitlist_offer_new":
      return "waitlist";
    default:
      return null;
  }
}
