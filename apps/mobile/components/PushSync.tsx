/**
 * Headless push sync. Mounted once inside the session + query providers, it:
 *   - registers the device's Expo push token when a user signs in (and removes
 *     it on sign-out),
 *   - routes a notification tap to its deep link (data.url), including the cold
 *     start case where the app was launched from a notification.
 *
 * Renders nothing. Must sit under <SessionProvider> (uses useSession + the core
 * push-token hooks) — see app/_layout.tsx.
 */
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useRegisterPushToken, useRemovePushToken } from "@inkd/core/hooks";

import { useSession } from "@/providers/session";
import { registerForPushNotificationsAsync } from "@/lib/push";

function openDeepLink(data: unknown) {
  if (!data || typeof data !== "object") return;
  const url = (data as { url?: unknown }).url;
  if (typeof url === "string" && url.length > 0) {
    router.push(url as never);
  }
}

export function PushSync() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const registerToken = useRegisterPushToken();
  const removeToken = useRemovePushToken();
  const tokenRef = useRef<string | null>(null);
  const registeredForUser = useRef<string | null>(null);

  // Register on sign-in, de-register on sign-out.
  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      const stale = tokenRef.current;
      if (stale) {
        removeToken.mutate(stale);
        tokenRef.current = null;
        registeredForUser.current = null;
        void Notifications.setBadgeCountAsync(0);
      }
      return;
    }

    if (registeredForUser.current === userId) return;

    void (async () => {
      const reg = await registerForPushNotificationsAsync();
      if (cancelled || !reg.token) return;
      registerToken.mutate(
        { token: reg.token, platform: reg.platform },
        {
          onSuccess: () => {
            tokenRef.current = reg.token;
            registeredForUser.current = userId;
          },
        },
      );
    })();

    return () => {
      cancelled = true;
    };
    // registerToken/removeToken mutations are stable; re-run only on user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Notification tap -> deep link (warm) + cold-start launch.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openDeepLink(response.notification.request.content.data);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openDeepLink(response.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);

  return null;
}
