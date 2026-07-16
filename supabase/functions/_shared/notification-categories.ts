// Canonical notification-type -> preference-category map + channel defaults.
//
// This is the SINGLE SOURCE OF TRUTH for the edge runtime, mirrored in two other
// places that MUST stay in sync:
//   - SQL: public.notification_category_for_type / notification_category_default_email
//          (migration 20260717060000_notification_delivery.sql) — used by the
//          enqueue trigger to decide which delivery rows to fan out.
//   - App: packages/core/src/notifications/categories.ts — used by the Settings
//          preferences UI (adds human labels/descriptions).
//
// Keeping the map here (pure, no IO) lets the fan-out prefs resolver be unit
// tested offline with `node --test`.

/** The ten preference categories a user can toggle channels for. */
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
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Map a raw notification `type` (written by the fan-out triggers) to its
 * preference category, or null when the type is uncategorized (in-app only). */
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
    default:
      return null;
  }
}

/** Categories whose EMAIL channel defaults ON (high-value transactional events:
 * the booking lifecycle + money + a scheduled session). Push + in-app default
 * ON for every category. Founder priority: "email for high-value only". */
const EMAIL_DEFAULT_ON: ReadonlySet<NotificationCategory> = new Set([
  "booking_request",
  "booking_accepted",
  "booking_declined",
  "session_reminder",
  "deposit",
]);

export interface ChannelPrefs {
  in_app: boolean;
  push: boolean;
  email: boolean;
}

/** The effective default channels for a category when the user has no stored
 * preference row. Mirrors the SQL defaults exactly. */
export function defaultChannels(category: NotificationCategory): ChannelPrefs {
  return {
    in_app: true,
    push: true,
    email: EMAIL_DEFAULT_ON.has(category),
  };
}

/**
 * Resolve a user's effective channels for a notification, given the raw type
 * and any stored preference row (null when they never customized this category).
 * A stored row overrides the default per-channel. Returns null when the type is
 * uncategorized (delivered in-app only, never push/email).
 *
 * This is the fan-out prefs resolver the enqueue trigger encodes in SQL; kept
 * here in TS so the same logic is unit-tested and reusable by the dispatcher.
 */
export function resolveChannels(
  type: string,
  stored: Partial<ChannelPrefs> | null | undefined,
): (ChannelPrefs & { category: NotificationCategory }) | null {
  const category = categoryForType(type);
  if (!category) return null;
  const def = defaultChannels(category);
  return {
    category,
    in_app: stored?.in_app ?? def.in_app,
    push: stored?.push ?? def.push,
    email: stored?.email ?? def.email,
  };
}
