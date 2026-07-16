import type { IconName } from "@inkd/ui/web";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export type ViewerRole = "artist" | "client";

/**
 * Top-level ("main") navigation.
 *
 * ARTISTS run their books from the STUDIO group, so Bookings lives there, not
 * in the top level — the top level is the consumer surface (Home, Discover,
 * Messages, Profile). CLIENTS have no Studio, so Bookings (their own
 * appointments) stays in their main nav.
 */
export const artistPrimaryNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "Messages", href: "/messages", icon: "message-circle" },
  { label: "Profile", href: "/profile", icon: "user" },
];

export const clientPrimaryNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "Bookings", href: "/bookings", icon: "calendar" },
  { label: "Messages", href: "/messages", icon: "message-circle" },
  { label: "Profile", href: "/profile", icon: "user" },
];

/**
 * Artist-only STUDIO group — the ops wedge. Bookings now leads into the ops
 * work (Dashboard, Bookings, AI staff, Settings) and sits directly under the
 * Dashboard where artists live.
 */
export const studioNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-grid" },
  { label: "Bookings", href: "/bookings", icon: "calendar" },
  { label: "AI staff", href: "/studio/ai", icon: "sparkles" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

/** The main-nav set (desktop sidebar / role top level) for a given role. */
export function primaryNavFor(role: ViewerRole): NavItem[] {
  return role === "artist" ? artistPrimaryNav : clientPrimaryNav;
}

/**
 * Mobile bottom tab bar. The Studio group can't fit on a phone's 5-tab bar, so
 * artists get a single "Studio" tab that opens the Dashboard hub (Bookings /
 * AI staff / Settings hang off it) — the same consolidation the native app
 * uses. Clients keep Bookings as a direct tab.
 */
export const artistBottomNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "Studio", href: "/dashboard", icon: "layout-grid" },
  { label: "Messages", href: "/messages", icon: "message-circle" },
  { label: "Profile", href: "/profile", icon: "user" },
];

export function bottomNavFor(role: ViewerRole): NavItem[] {
  return role === "artist" ? artistBottomNav : clientPrimaryNav;
}

/**
 * @deprecated Prefer `primaryNavFor(role)` / `studioNav`. Kept so any external
 * import keeps resolving; defaults to the client (Bookings-in-main) set.
 */
export const primaryNav = clientPrimaryNav;
/** @deprecated Renamed to `studioNav`. */
export const artistNav = studioNav;

export function isActivePath(current: string, href: string): boolean {
  return current === href || current.startsWith(`${href}/`);
}
