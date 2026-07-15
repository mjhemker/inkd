/** Data access: notifications (recipient-scoped under RLS). */
import type { InkdSupabaseClient } from "../supabase/client";
import type { Notification } from "../types/rows";
import { unwrapList, clampLimit } from "./helpers";

export async function listNotifications(
  client: InkdSupabaseClient,
  profileId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  let query = client
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(clampLimit(opts.limit));
  if (opts.unreadOnly) query = query.eq("is_read", false);
  return unwrapList(await query);
}

export async function countUnreadNotifications(
  client: InkdSupabaseClient,
  profileId: string,
): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(
  client: InkdSupabaseClient,
  profileId: string,
): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("is_read", false);
  if (error) throw error;
}
