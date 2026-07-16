/**
 * Data access: notification preferences + device push tokens (both RLS
 * owner-only). Preferences drive the multi-channel fan-out done by the DB
 * enqueue trigger in 20260717060000_notification_delivery.sql; a MISSING row
 * means "use the category default", so `resolveEffectivePreferences` merges the
 * stored rows over the shared defaults for display.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { NotificationPreference } from "../types/rows";
import {
  NOTIFICATION_CATEGORIES,
  defaultChannels,
  type ChannelPrefs,
  type NotificationCategory,
} from "../notifications/categories";

export interface EffectiveNotificationPreference extends ChannelPrefs {
  category: NotificationCategory;
}

/** Read the caller's stored preference rows (may be empty). */
export async function listNotificationPreferences(
  client: InkdSupabaseClient,
  userId: string,
): Promise<NotificationPreference[]> {
  const { data, error } = await client
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Merge stored rows over the per-category defaults into one row per category,
 * in the canonical order — what the Settings UI renders. */
export function resolveEffectivePreferences(
  stored: NotificationPreference[],
): EffectiveNotificationPreference[] {
  const byCategory = new Map(stored.map((r) => [r.category, r]));
  return NOTIFICATION_CATEGORIES.map((category) => {
    const row = byCategory.get(category);
    const def = defaultChannels(category);
    return {
      category,
      in_app: row?.in_app ?? def.in_app,
      push: row?.push ?? def.push,
      email: row?.email ?? def.email,
    };
  });
}

/** Convenience: read + resolve in one call. */
export async function getEffectiveNotificationPreferences(
  client: InkdSupabaseClient,
  userId: string,
): Promise<EffectiveNotificationPreference[]> {
  const stored = await listNotificationPreferences(client, userId);
  return resolveEffectivePreferences(stored);
}

/** Upsert the full channel set for one category. */
export async function upsertNotificationPreference(
  client: InkdSupabaseClient,
  userId: string,
  category: NotificationCategory,
  channels: ChannelPrefs,
): Promise<void> {
  const { error } = await client
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        category,
        in_app: channels.in_app,
        push: channels.push,
        email: channels.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" },
    );
  if (error) throw error;
}

// --- Device push tokens -----------------------------------------------------

export type PushPlatform = "ios" | "android" | "web";

/** Register (or re-claim) an Expo push token for the calling user via the
 * SECURITY DEFINER `register_push_token` RPC (handles device handoff). */
export async function registerPushToken(
  client: InkdSupabaseClient,
  token: string,
  platform: PushPlatform,
): Promise<void> {
  const { error } = await client.rpc("register_push_token", {
    p_token: token,
    p_platform: platform,
  });
  if (error) throw error;
}

/** Remove a token (e.g. on sign-out, or when permission is revoked). */
export async function removePushToken(
  client: InkdSupabaseClient,
  token: string,
): Promise<void> {
  const { error } = await client
    .from("device_push_tokens")
    .delete()
    .eq("expo_push_token", token);
  if (error) throw error;
}
