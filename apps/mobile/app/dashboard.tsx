import { Redirect } from "expo-router";

/**
 * Legacy path alias. The artist dashboard now lives inside the Studio tab
 * (app/(tabs)/studio/index.tsx → /studio) so the bottom tab bar stays visible.
 * Any old deep link or bookmark to /dashboard redirects into the Studio tab.
 * PushSync/notifications normalize this path before navigating (lib/nav.ts);
 * this stub is the belt-and-suspenders fallback for links that bypass it.
 */
export default function DashboardRedirect() {
  return <Redirect href="/studio" />;
}
