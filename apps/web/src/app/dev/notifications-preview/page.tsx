"use client";

/**
 * Dev-only preview harness for the notification bell + dropdown + full
 * `/notifications` page. Renders the REAL `NotificationBell` and
 * `NotificationsHub` components against a mock Supabase client
 * (`mockNotificationsClient.ts`) instead of the live
 * `khlpidflnvkqafkvkpfy.supabase.co` project, because this sandbox's egress
 * policy blocks that host for browser requests here.
 *
 * Never linked from product nav. Not for production use.
 */
import { InkdProvider } from "@inkd/core/hooks";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationsHub } from "@/components/notifications/notifications-hub";
import {
  createMockNotificationsClient,
  type MockNotificationSeed,
} from "./mockNotificationsClient";

// Fixed (not `Date.now()`) so server- and client-rendered output match, and
// so the relative timestamps in the list stay stable across screenshot runs.
const NOW = new Date("2026-07-15T20:00:00.000Z");
const PROFILE_ID = "demo-profile-jayden";

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}

const SEED_NOTIFICATIONS: MockNotificationSeed[] = [
  {
    id: "n-1",
    profile_id: PROFILE_ID,
    type: "booking_request_new",
    title: "New booking request",
    body: "Mara Vance sent you a booking request for a fine-line floral sleeve.",
    action_url: "/bookings/requests/demo-1",
    data: { seed: true },
    is_read: false,
    read_at: null,
    created_at: hoursAgo(0.5),
  },
  {
    id: "n-2",
    profile_id: PROFILE_ID,
    type: "message_new",
    title: "New message",
    body: "Riley Client: Also — should I bring reference photos?",
    action_url: "/messages/demo-thread-1",
    data: { seed: true },
    is_read: false,
    read_at: null,
    created_at: hoursAgo(2),
  },
  {
    id: "n-3",
    profile_id: PROFILE_ID,
    type: "payment_deposit_received",
    title: "Deposit received",
    body: "Mara Vance paid a $200.00 deposit.",
    action_url: "/bookings/demo-booking-1",
    data: { seed: true },
    is_read: false,
    read_at: null,
    created_at: hoursAgo(5),
  },
  {
    id: "n-4",
    profile_id: PROFILE_ID,
    type: "review_new",
    title: "New review",
    body: "Mara Vance left you a 5-star review.",
    action_url: "/bookings/demo-booking-3",
    data: { seed: true },
    is_read: true,
    read_at: hoursAgo(20),
    created_at: hoursAgo(22),
  },
  {
    id: "n-5",
    profile_id: PROFILE_ID,
    type: "session_scheduled",
    title: "Session scheduled",
    body: "Session #2 with Mara Vance on August 22, 2026.",
    action_url: "/bookings/demo-booking-1",
    data: { seed: true },
    is_read: true,
    read_at: hoursAgo(30),
    created_at: hoursAgo(31),
  },
  {
    id: "n-6",
    profile_id: PROFILE_ID,
    type: "booking_request_accepted",
    title: "Booking request accepted",
    body: "You accepted Riley Client's booking request.",
    action_url: "/bookings/requests/demo-2",
    data: { seed: true },
    is_read: true,
    read_at: hoursAgo(48),
    created_at: hoursAgo(49),
  },
  {
    id: "n-7",
    profile_id: PROFILE_ID,
    type: "review_response",
    title: "Your artist replied to your review",
    body: "You responded to Mara Vance's review.",
    action_url: "/bookings/demo-booking-3",
    data: { seed: true },
    is_read: true,
    read_at: hoursAgo(70),
    created_at: hoursAgo(71),
  },
  {
    id: "n-8",
    profile_id: PROFILE_ID,
    type: "booking_request_declined",
    title: "Booking request declined",
    body: "You declined a booking request outside your travel range.",
    action_url: "/bookings/requests/demo-3",
    data: { seed: true },
    is_read: true,
    read_at: hoursAgo(96),
    created_at: hoursAgo(97),
  },
];

const mockClient = createMockNotificationsClient(
  PROFILE_ID,
  {
    id: PROFILE_ID,
    handle: "jayden.ink",
    display_name: "Jayden Cole",
    email: "demo-booking-artist@inkd.test",
    phone: null,
    avatar_url: null,
    bio: null,
    is_artist: true,
    is_public: true,
    city: "Baltimore",
    state: "MD",
    created_at: hoursAgo(1000),
    updated_at: hoursAgo(1000),
  },
  SEED_NOTIFICATIONS,
);

export default function NotificationsPreviewPage() {
  return (
    <InkdProvider client={mockClient}>
      <div className="min-h-dvh bg-surface-base text-content-primary">
        <header
          data-testid="header-bar"
          className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-surface-base/85 px-6 backdrop-blur"
        >
          <span className="font-display text-lg font-bold tracking-tight">
            INKD
          </span>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-6 py-10">
          <div data-testid="notifications-page-section">
            <NotificationsHub />
          </div>
        </main>
      </div>
    </InkdProvider>
  );
}
