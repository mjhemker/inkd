import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Legacy path alias. Studio settings now live inside the Studio tab
 * (app/(tabs)/studio/settings.tsx → /studio/settings) so the bottom tab bar
 * stays visible. Old deep links to /settings?tab=… redirect in, preserving the
 * tab param. PushSync/notifications normalize this path before navigating
 * (lib/nav.ts); this stub is the fallback for links that bypass it.
 */
export default function SettingsRedirect() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return (
    <Redirect
      href={tab ? { pathname: "/studio/settings", params: { tab } } : "/studio/settings"}
    />
  );
}
