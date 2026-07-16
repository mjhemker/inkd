/**
 * Hooks: notification preferences (Settings > Notifications) + push-token
 * registration. The list hook returns one effective row per category (stored
 * prefs merged over defaults); the mutation upserts a single category and
 * optimistically patches the cache so a toggle feels instant.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getEffectiveNotificationPreferences,
  registerPushToken,
  removePushToken,
  upsertNotificationPreference,
  type EffectiveNotificationPreference,
  type PushPlatform,
} from "../api/notificationPreferences";
import type { ChannelPrefs, NotificationCategory } from "../notifications/categories";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

/** Effective per-category channel preferences for the current user. */
export function useNotificationPreferences(userId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.notificationPreferences(userId ?? ""),
    queryFn: () => getEffectiveNotificationPreferences(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Upsert one category's channels, with an optimistic cache patch. */
export function useSetNotificationPreference(userId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const key = queryKeys.notificationPreferences(userId ?? "");

  return useMutation({
    mutationFn: (vars: { category: NotificationCategory; channels: ChannelPrefs }) =>
      upsertNotificationPreference(client, userId as string, vars.category, vars.channels),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EffectiveNotificationPreference[]>(key);
      if (prev) {
        qc.setQueryData<EffectiveNotificationPreference[]>(
          key,
          prev.map((p) =>
            p.category === vars.category ? { ...p, ...vars.channels } : p,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** Register the device's Expo push token for the current user. */
export function useRegisterPushToken() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (vars: { token: string; platform: PushPlatform }) =>
      registerPushToken(client, vars.token, vars.platform),
  });
}

/** Remove a device's Expo push token (sign-out / permission revoked). */
export function useRemovePushToken() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (token: string) => removePushToken(client, token),
  });
}
