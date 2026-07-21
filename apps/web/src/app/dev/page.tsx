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
    href: "/dev/zine-preview",
    title: "Zine system — hierarchy foundation",
    description:
      "The one-hero law: the hero Button + hero Card offset shadow (ink in daylight / ember at night), ink-inverted tabs, and the stamp/date/status/money vocabulary. Flip Appearance to review both themes. See docs/zine-hierarchy.md.",
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
    href: "/dev/settings-preview",
    title: "Settings + dashboard shell",
    description:
      "The REAL SettingsView and DashboardPreview inside the REAL AppShell against an in-memory mock Supabase client — tab rail, full-width content, real stats. Try ?screen=dashboard.",
  },
  {
    href: "/dev/account-preview",
    title: "Account controls",
    description:
      "The Settings → Account controls (Switch-to-client + Danger Zone deletion) with their confirmation modals, rendered outside the auth wall.",
  },
  {
    href: "/dev/hours-preview",
    title: "Weekly hours grid",
    description:
      "The Calendly-style WeeklyHoursGrid availability editor: empty grid, drag-created multi-block week, block popover, and time-off shading — plus the full BookingEditor it lives in.",
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
    href: "/dev/bookings-calendar-preview",
    title: "Bookings — calendar & pipeline",
    description:
      "The artist Bookings calendar (real week grid with positioned/overlapping session placards + exact header nav, and the month grid) and the full-width pipeline board, against seeded offline sessions/bookings.",
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
    href: "/dev/try-on-preview",
    title: "Fit check (try-on)",
    description:
      "The photo-based tattoo fit-check editor preloaded with a sample body photo + design: drag/scale/rotate, ink (multiply) blend, wrap/opacity, before/after, and the stamped export placard. Fully offline, client-side only.",
  },
  {
    href: "/dev/ai-staff-preview",
    title: "AI staff — trust surfaces",
    description:
      "The /studio/ai area (AiStaffView): approvals inbox with placard cards, provenance + tier stamps, the activity ledger, and the playbook editor — against a seeded mock of the agent_actions contract.",
  },
  {
    href: "/dev/instagram-preview",
    title: "Instagram import + share kit",
    description:
      "The settings 'Share & connect' tab: the key-gated Instagram import scaffold and the working booking-link share kit, against an in-memory fake client. Try ?scenario=not-configured|not-connected|connected.",
  },
  {
    href: "/dev/plan-preview",
    title: "INKD Pro — premium tier",
    description:
      "The premium tier scaffold: the 'INKD Pro — coming soon' placard and the autonomy slider's pilot note + PRO stamp, rendered against a mock Supabase client.",
  },
  {
    href: "/dev/shop-preview",
    title: "Shops — public page & roster",
    description:
      "Wave 2: the /s/[handle] public shop profile and the owner dashboard roster (managed / promotional / pending members), rendered against a mock shop client.",
  },
  {
    href: "/dev/daily-drop-preview",
    title: "Daily Drop",
    description:
      "Wave 2: the personalized Daily Drop card + dedicated surface, driven by the offline selection algorithm.",
  },
  {
    href: "/dev/match-inspiration",
    title: "Match my inspiration",
    description:
      "Wave 2: upload-a-tattoo image match experience over similar_works, with the discover/feed entry points.",
  },
  {
    href: "/dev/waitlist-preview",
    title: "Waitlist — join, offer & claim",
    description:
      "Wave 2: client join/manage + offer/claim flow and the artist-side waitlist view. Supports ?only= for per-surface screenshots.",
  },
  {
    href: "/dev/round4-booking-preview",
    title: "Round 4 — booking polish",
    description:
      "Round 4: theme-aware BodyMap silhouette, the reserve-space FormField two-column rows, and the dual-thumb budget RangeSlider, in both themes.",
  },
  {
    href: "/dev/round4-drops-match",
    title: "Round 4 — daily drop + match",
    description:
      "Round 4: the full-screen DailyDropReveal takeover + feed drop card progression, and the zero-config match-inspiration always-return fallback gallery.",
  },
  {
    href: "/dev/feed-filter-preview",
    title: "Round 4 — feed filters",
    description:
      "Round 4: the feed FeedFilterPanel (web popover) with multi-style, location, price range and open-books controls, active-filter chips, and the nowrap style chip row.",
  },
  {
    href: "/dev/search-preview",
    title: "Round 4 — global search",
    description:
      "Round 4: the global SearchOverlay (⌘K) across artists, shops, styles and cities against a seeded offline search client.",
  },
  {
    href: "/dev/bookings-inbox-preview",
    title: "Round 4 — bookings inbox",
    description:
      "Round 4: the bookings request inbox with the differentiated 'New' stamp vs. Medical badge, against seeded offline requests.",
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
