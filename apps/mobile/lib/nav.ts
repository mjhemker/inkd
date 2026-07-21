/**
 * Mobile navigation + deep-link path mapping (pure, testable).
 *
 * The artist Studio surfaces (dashboard, bookings, AI staff, settings, shop)
 * live INSIDE the Studio tab's nested stack — app/(tabs)/studio/* — so the
 * bottom tab bar stays visible on every one of them. Two paths predate that
 * move and still appear in older notifications / links:
 *   /dashboard  and  /settings
 * `normalizeDeepLink` rewrites them to their in-tab canonical routes so a
 * notification tap lands INSIDE the Studio tab (bar visible) rather than on a
 * root-level screen that would cover the bar. Root redirect stubs
 * (app/dashboard.tsx, app/settings.tsx) are the belt-and-suspenders fallback
 * for any link that bypasses this normalizer (e.g. a cold-start OS deep link).
 *
 *   node --test apps/mobile/lib/nav.test.ts
 */

/**
 * The five persistent hub surfaces that must always keep the tab bar. Anything
 * else (booking detail, message thread, waiver, public artist/shop page) is a
 * root-level push that may cover the bar by design.
 */
export const HUB_TAB_ROUTES = [
  "index",
  "discover",
  "messages",
  "profile",
  "studio",
] as const;

/**
 * The bottom-tab labels a role sees, in order. Mirrors app/(tabs)/_layout.tsx
 * `href` gating — kept here so the contract is unit-testable without a renderer.
 *
 *   Clients → Home · Discover · Inbox · Profile           (4 tabs)
 *   Artists → Home · Discover · Inbox · Profile · Studio  (5 tabs)
 *
 * Inbox (the Messages surface, relabeled) now gets its OWN middle slot for BOTH
 * roles — no longer swapped out for artists. The artist Studio tab takes the
 * fifth slot on the right. The messages inbox icon that briefly lived in the
 * Studio dashboard header is gone; Inbox on the bar is the single entry point.
 * Discover is slot 2 for both.
 */
export function visibleTabLabels(isArtist: boolean): readonly string[] {
  return isArtist
    ? ["Home", "Discover", "Inbox", "Profile", "Studio"]
    : ["Home", "Discover", "Inbox", "Profile"];
}

/**
 * The internal Studio sections, in order, with their in-tab route and the
 * one-line muted snippet shown under the segmented bar. The segmented header
 * (components/studio/StudioSegments.tsx) renders the labels and the tab bar
 * stays visible while switching between them; StudioScreen renders the snippet
 * for the active section instead of a big per-tab H1 title.
 */
export const STUDIO_SECTIONS = [
  {
    value: "dashboard",
    label: "Dashboard",
    route: "/studio",
    snippet: "Your operational overview — bookings, revenue, and requests at a glance.",
  },
  {
    value: "bookings",
    label: "Bookings",
    route: "/studio/bookings",
    snippet: "Every request from first inquiry to healed and rebooked.",
  },
  {
    value: "ai",
    label: "AI staff",
    route: "/studio/ai",
    snippet: "Your staff that show their work — approvals, activity, playbook.",
  },
  {
    value: "settings",
    label: "Settings",
    route: "/studio/settings",
    snippet: "Your studio, services, hours and preferences.",
  },
] as const;

export type StudioSection = (typeof STUDIO_SECTIONS)[number]["value"];

/** Legacy path -> canonical in-tab path. Ordered longest-prefix-first is not
 * needed here because the two prefixes don't overlap. */
const LEGACY_PATH_MAP: readonly { from: string; to: string }[] = [
  { from: "/dashboard", to: "/studio" },
  { from: "/settings", to: "/studio/settings" },
];

/**
 * Rewrite a legacy deep link to its in-tab canonical path, preserving any query
 * string / hash and sub-path. Unknown or already-canonical paths pass through
 * unchanged.
 *
 *   /dashboard                 -> /studio
 *   /settings                  -> /studio/settings
 *   /settings?tab=shop         -> /studio/settings?tab=shop
 *   /studio/ai?tab=activity    -> /studio/ai?tab=activity   (already in-tab)
 *   /studio/shop               -> /studio/shop              (already in-tab)
 *   /bookings/123              -> /bookings/123             (detail; covers bar)
 */
export function normalizeDeepLink(path: string): string {
  if (typeof path !== "string" || !path.startsWith("/")) return path;
  const splitAt = path.search(/[?#]/);
  const pathname = splitAt === -1 ? path : path.slice(0, splitAt);
  const suffix = splitAt === -1 ? "" : path.slice(splitAt);
  for (const { from, to } of LEGACY_PATH_MAP) {
    if (pathname === from) return to + suffix;
    if (pathname.startsWith(`${from}/`)) return to + pathname.slice(from.length) + suffix;
  }
  return path;
}
