import type { IconName } from "@inkd/ui/web";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

/** Shared client + artist navigation. Bottom tabs on mobile use `primaryNav`. */
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "Bookings", href: "/bookings", icon: "calendar" },
  { label: "Messages", href: "/messages", icon: "message-circle" },
  { label: "Profile", href: "/profile", icon: "user" },
];

/** Artist-only surfaces — the ops wedge. Shown in the desktop sidebar. */
export const artistNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-grid" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

export function isActivePath(current: string, href: string): boolean {
  return current === href || current.startsWith(`${href}/`);
}
