"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentProfile,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@inkd/core";
import { Button, Chip, EmptyState, Icon, Skeleton } from "@inkd/ui/web";
import { NOTIFICATION_FILTER_TYPES, notificationKindMeta } from "@/lib/notifications";
import { NotificationRow } from "./notification-row";

const PAGE_SIZE = 20;

type FilterValue = "all" | (typeof NOTIFICATION_FILTER_TYPES)[number];

/** Full `/notifications` page: filter chips by kind, mark-all-read, and a
 * "Load more" paginated list. Clicking a row marks it read and follows its
 * deep link (e.g. `/bookings/[id]`, `/messages/[threadId]`). */
export function NotificationsHub() {
  const router = useRouter();
  const { data: profile } = useCurrentProfile();
  const profileId = profile?.id;

  const [filter, setFilter] = useState<FilterValue>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const listQ = useNotifications(profileId, {
    type: filter === "all" ? undefined : filter,
    limit: visibleCount,
  });
  const markRead = useMarkNotificationRead(profileId);
  const markAllRead = useMarkAllNotificationsRead(profileId);

  const notifications = listQ.data ?? [];
  const hasMore = notifications.length >= visibleCount;

  function handleSelect(notification: Notification) {
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.action_url) router.push(notification.action_url);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="notifications-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-content-primary">
          Notifications
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || notifications.every((n) => n.is_read)}
        >
          <Icon name="check" size={16} />
          Mark all read
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="notification-filters">
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {NOTIFICATION_FILTER_TYPES.map((type) => {
          const meta = notificationKindMeta(type);
          return (
            <Chip
              key={type}
              selected={filter === type}
              leadingIcon={<Icon name={meta.icon} size={14} />}
              onClick={() => setFilter(type)}
            >
              {meta.label}
            </Chip>
          );
        })}
      </div>

      {listQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Icon name="bell" size={26} />}
          title="No notifications yet"
          description="Booking activity, payments, reviews, and messages will show up here as they happen."
          note="quiet in here"
        />
      ) : (
        <div className="flex flex-col rounded-xl border border-border-subtle bg-surface-base">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {notifications.map((n) => (
              <li key={n.id} className="px-1">
                <NotificationRow notification={n} onSelect={handleSelect} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMore && !listQ.isLoading && (
        <Button
          variant="secondary"
          size="sm"
          className="self-center"
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
