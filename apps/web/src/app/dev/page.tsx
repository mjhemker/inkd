import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "INKD dev harness (internal)",
  robots: { index: false, follow: false },
};

/**
 * Internal-only index of the offline preview/dev harness routes. These render
 * without a live Supabase connection (mocked/seeded data) so components can be
 * built and reviewed in isolation. Not linked from product nav.
 */
const DEV_ROUTES: { href: string; title: string; description: string }[] = [
  {
    href: "/dev/ui",
    title: "UI kit",
    description: "Gallery of @inkd/ui primitives — buttons, inputs, cards, modals, tokens.",
  },
  {
    href: "/dev/shell",
    title: "App shell",
    description: "The signed-in AppShell chrome (sidebar + mobile tab bar) in isolation.",
  },
  {
    href: "/dev/onboarding-preview",
    title: "Onboarding flow",
    description: "Full artist onboarding wizard driven by an offline fake client.",
  },
  {
    href: "/dev/feed-preview",
    title: "Discovery feed",
    description:
      "The signed-in home feed (FeedScreen, museum placards, flash ember stamps, post detail overlay) against a seeded mock feed client.",
  },
  {
    href: "/dev/profile-preview",
    title: "Own-profile management",
    description: "Artist self-profile editor against a seeded mock Supabase client.",
  },
  {
    href: "/dev/profile-preview/public",
    title: "Public artist profile",
    description: "The consumer-facing /a/[handle] profile with seeded demo content.",
  },
  {
    href: "/dev/messages-preview",
    title: "Chat + attachments",
    description:
      "Messaging thread with image attachments (Composer, ChatThread, MessageBubble) against a mock chat client.",
  },
  {
    href: "/dev/discover",
    title: "Local discovery",
    description:
      "The /discover map + list hybrid (FilterBar, ArtistPlacard, MapLibre map) with seeded cards and offline filter/sort semantics.",
  },
  {
    href: "/dev/reviews-preview",
    title: "Reviews — form & response",
    description:
      "The leave-a-review / edit-review modal and the artist response field in isolation. Reviews tab + hero rating live at /dev/profile-preview/public.",
  },
  {
    href: "/dev/notifications-preview",
    title: "Notifications",
    description:
      "Bell + unread badge, dropdown panel, and the full /notifications page (NotificationBell, NotificationsHub) against seeded fixture data.",
  },
  {
    href: "/dev/ai-staff-preview",
    title: "AI staff — trust surfaces",
    description:
      "The /studio/ai area (AiStaffView): approvals inbox with placard cards, provenance + tier stamps, the activity ledger, and the playbook editor — against a seeded mock of the agent_actions contract.",
  },
];

export default function DevIndexPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 py-12">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
          Internal · not for production
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Dev harness
        </h1>
        <p className="text-content-secondary">
          Offline preview routes for building and reviewing INKD surfaces without
          a live backend. These pages are not linked from product navigation.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {DEV_ROUTES.map((route) => (
          <li key={route.href}>
            <Link
              href={route.href}
              className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-base px-5 py-4 transition-colors hover:border-border-strong"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-content-primary">
                  {route.title}
                </span>
                <span className="text-sm text-content-secondary">
                  {route.description}
                </span>
                <span className="mt-1 font-mono text-xs text-content-muted">
                  {route.href}
                </span>
              </span>
              <span aria-hidden className="text-content-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
