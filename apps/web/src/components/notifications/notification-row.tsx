"use client";

import { formatThreadTimestamp, type Notification } from "@inkd/core";
import { Icon, cx } from "@inkd/ui/web";
import { notificationKindMeta } from "@/lib/notifications";

/**
 * One notification row — shared by the header dropdown (compact) and the
 * `/notifications` page (full width). Unread rows carry a violet dot + a
 * faint tint; clicking marks read and hands off navigation to the caller
 * (dropdown closes + routes, page just routes) via `onSelect`.
 */
export function NotificationRow({
  notification,
  onSelect,
  compact = false,
}: {
  notification: Notification;
  onSelect: (notification: Notification) => void;
  compact?: boolean;
}) {
  const meta = notificationKindMeta(notification.type);
  const unread = !notification.is_read;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cx(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand",
        unread && "bg-surface-overlay/60",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
          unread ? "bg-surface-plate-ink text-content-accent" : "bg-surface-overlay text-content-muted",
        )}
      >
        <Icon name={meta.icon} size={16} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cx(
              "truncate text-sm font-semibold",
              unread ? "text-content-primary" : "text-content-secondary",
            )}
          >
            {notification.title ?? "Notification"}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-content-muted">
            {formatThreadTimestamp(notification.created_at)}
          </span>
        </span>
        {notification.body && (
          <span
            className={cx(
              "mt-0.5 block text-xs text-content-muted",
              compact ? "line-clamp-1" : "line-clamp-2",
            )}
          >
            {notification.body}
          </span>
        )}
      </span>

      {unread && (
        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
      )}
    </button>
  );
}
