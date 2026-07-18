"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCurrentProfile,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type Notification,
} from "@inkd/core";
import { EmptyState, Icon, Spinner, cx } from "@inkd/ui/web";
import { NotificationRow } from "./notification-row";

const DROPDOWN_LIMIT = 10;

/**
 * Header bell: unread badge (solid alert-red stamp when > 0) + a dropdown panel
 * with the 10 most recent notifications. Realtime-backed via
 * `useUnreadNotificationCount` / `useNotifications` (postgres_changes INSERT
 * on `public.notifications`, scoped to the signed-in profile).
 */
export function NotificationBell() {
  const router = useRouter();
  const { data: profile } = useCurrentProfile();
  const profileId = profile?.id;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadQ = useUnreadNotificationCount(profileId);
  const listQ = useNotifications(profileId, { limit: DROPDOWN_LIMIT });
  const markRead = useMarkNotificationRead(profileId);
  const markAllRead = useMarkAllNotificationsRead(profileId);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = unreadQ.data ?? 0;

  function handleSelect(notification: Notification) {
    setOpen(false);
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.action_url) router.push(notification.action_url);
  }

  if (!profileId) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-raised hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger-600 px-1 font-mono text-[10px] font-bold leading-none text-neutral-50"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[28rem] w-[22rem] flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-base shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
            <span className="font-display text-sm font-bold text-content-primary">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="font-mono text-[11px] uppercase tracking-wide text-content-accent outline-none transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {listQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-content-muted">
                <Spinner size={18} />
              </div>
            ) : (listQ.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Icon name="bell" size={22} />}
                title="You're all caught up"
                description="New activity on your bookings, messages, and reviews shows up here."
                className="py-10"
              />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {(listQ.data ?? []).map((n) => (
                  <li key={n.id}>
                    <NotificationRow notification={n} onSelect={handleSelect} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={cx(
              "border-t border-border-subtle px-4 py-3 text-center font-sans text-sm font-semibold text-content-secondary outline-none transition-colors hover:bg-surface-raised hover:text-content-primary",
            )}
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
