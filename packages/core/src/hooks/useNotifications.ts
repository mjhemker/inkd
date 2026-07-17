/**
 * Hooks: the notification bell + inbox (SPEC — in-app notifications). Live
 * unread count for the header badge, a paginated/filterable list for the
 * dropdown + `/notifications` page, and mark-read mutations. Realtime follows
 * the pattern in `./useMessages.ts` (`subscribeToThreadMessages`).
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type ListNotificationsOpts,
} from "../api/notifications";
import type { Notification } from "../types/rows";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

/**
 * Live-updating unread count for the bell badge. Backfills via TanStack Query
 * and bumps in place as Realtime pushes new rows in — no full refetch needed
 * for the common "badge went from 3 to 4" case.
 */
export function useUnreadNotificationCount(profileId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const key = [...queryKeys.notifications(profileId ?? ""), "unreadCount"] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => countUnreadNotifications(client, profileId as string),
    enabled: Boolean(profileId),
  });

  useEffect(() => {
    if (!profileId) return;
    const unsubscribe = subscribeToNotifications(client, profileId, () => {
      qc.setQueryData<number>(key, (prev) => (prev ?? 0) + 1);
      // Also invalidate the list so an open dropdown/page picks up the row.
      void qc.invalidateQueries({ queryKey: queryKeys.notifications(profileId) });
    });
    return unsubscribe;
    // `key`/`qc` are stable for a given profileId; re-subscribe only when the
    // client or profile changes (intentionally omitting `key`/`qc` below).
  }, [client, profileId]);

  return query;
}

/**
 * Paginated, optionally filtered notification list (dropdown's "recent 10"
 * and the full `/notifications` page both use this — pass `limit`/`type`).
 * New rows pushed over Realtime are prepended in place, deduped by id.
 */
export function useNotifications(
  profileId: string | undefined,
  opts: ListNotificationsOpts = {},
) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const { unreadOnly, type, limit, offset } = opts;
  const key = [
    ...queryKeys.notifications(profileId ?? ""),
    { unreadOnly: unreadOnly ?? false, type: type ?? null, limit: limit ?? null, offset: offset ?? null },
  ] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => listNotifications(client, profileId as string, opts),
    enabled: Boolean(profileId),
  });

  useEffect(() => {
    if (!profileId) return;
    const unsubscribe = subscribeToNotifications(client, profileId, (incoming) => {
      qc.setQueryData<Notification[]>(key, (prev) => {
        if (!prev) return prev;
        if (prev.some((n) => n.id === incoming.id)) return prev;
        // Only splice into an unfiltered-by-type-mismatch, first-page view;
        // otherwise let the invalidate below settle it via refetch.
        if (type && incoming.type !== type) return prev;
        if (offset && offset > 0) return prev;
        return [incoming, ...prev];
      });
    });
    return unsubscribe;
    // `key`/`qc` are stable for given args; re-subscribe only when the
    // client, profile, or filter identity changes.
  }, [client, profileId, type, offset]);

  return query;
}

export function useMarkNotificationRead(profileId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(client, id),
    onSuccess: () => {
      if (!profileId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.notifications(profileId) });
    },
  });
}

export function useMarkAllNotificationsRead(profileId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(client, profileId as string),
    onSuccess: () => {
      if (!profileId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.notifications(profileId) });
    },
  });
}
