/**
 * Data access: notifications (recipient-scoped under RLS). Rows are written
 * server-side by the fan-out triggers in
 * `supabase/migrations/20260716050000_notification_triggers.sql` (new
 * booking request, request accepted/declined, session scheduled, deposit
 * received, new review, review response, new message — throttled). This
 * module is read/mark-read only; the app never inserts a notification row
 * directly (the `notifications_insert` RLS policy only lets a caller write
 * their own row, which the SECURITY DEFINER triggers bypass).
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { Notification } from "../types/rows";
import { unwrapList, clampLimit } from "./helpers";
import { subscribeShared } from "./realtimeShare";

export interface ListNotificationsOpts {
  unreadOnly?: boolean;
  /** Filter to a single notification `type` (e.g. "message_new"). */
  type?: string;
  limit?: number;
  /** Row offset for "load more" pagination. */
  offset?: number;
}

export async function listNotifications(
  client: InkdSupabaseClient,
  profileId: string,
  opts: ListNotificationsOpts = {},
): Promise<Notification[]> {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(0, opts.offset ?? 0);
  let query = client
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.unreadOnly) query = query.eq("is_read", false);
  if (opts.type) query = query.eq("type", opts.type);
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

/**
 * Subscribe to newly-inserted notifications for a profile over Realtime.
 * Returns an unsubscribe function. Mirrors `subscribeToThreadMessages` in
 * `./messaging.ts` — RLS still scopes delivery to the recipient's own rows
 * even though this filters by `profile_id` for efficiency.
 *
 * Shared per `profileId` via `subscribeShared` — e.g. `NotificationBell`
 * mounts both `useUnreadNotificationCount` and `useNotifications` for the
 * same profile at once, and they now fan out from one underlying channel
 * instead of each opening their own.
 *
 * @example
 *   const unsubscribe = subscribeToNotifications(supabase, profileId, (n) => {...});
 *   // later: unsubscribe();
 */
export function subscribeToNotifications(
  client: InkdSupabaseClient,
  profileId: string,
  onInsert: (notification: Notification) => void,
): () => void {
  return subscribeShared<Notification>(
    client,
    `notifications:${profileId}`,
    (channel, dispatch) =>
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `profile_id=eq.${profileId}`,
          },
          (payload) => dispatch(payload.new as Notification),
        )
        .subscribe(),
    onInsert,
  );
}
