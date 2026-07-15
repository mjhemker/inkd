"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  Badge,
  Eyebrow,
  EmptyState,
  Icon,
  Input,
  Spinner,
  cx,
} from "@inkd/ui/web";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useThreadSummaries,
} from "@inkd/core/hooks";
import { formatThreadTimestamp } from "@inkd/core/utils";
import type { ThreadSummary } from "@inkd/core/api";

/**
 * Left pane of `/messages`: search + the live thread list. Shared by the
 * index route and the detail route (via `MessagesShell`) so both panes stay
 * mounted together on desktop and swap on mobile.
 */
export function ThreadListPane() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const { data: profile } = useCurrentProfile();
  const { data: artistProfile } = useCurrentArtistProfile();
  const { data: threads, isLoading } = useThreadSummaries(
    profile?.id,
    artistProfile?.id,
  );

  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const name = t.counterpart?.displayName?.toLowerCase() ?? "";
      const handle = t.counterpart?.handle?.toLowerCase() ?? "";
      const preview = t.lastMessage?.body?.toLowerCase() ?? "";
      return name.includes(q) || handle.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-border-subtle px-4 pb-4 pt-5">
        <Eyebrow>Inbox</Eyebrow>
        <Input
          size="sm"
          placeholder="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leadingIcon={<Icon name="search" size={16} />}
          aria-label="Search conversations"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-content-muted">
            <Spinner size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            className="px-4 py-14"
            icon={<Icon name="message-circle" size={24} />}
            title={
              threads && threads.length > 0
                ? "No matches"
                : "No conversations yet"
            }
            description={
              threads && threads.length > 0
                ? `Nothing matches "${query}".`
                : "Message an artist from their profile, or a client from a booking — it'll land here."
            }
          />
        ) : (
          <ul className="flex flex-col">
            {filtered.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                active={pathname === `/messages/${thread.id}`}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
}: {
  thread: ThreadSummary;
  active: boolean;
}) {
  const unread = thread.unreadCount > 0;
  const last = thread.lastMessage;
  const isAgentDraft = last?.senderKind === "agent";

  return (
    <li>
      <Link
        href={`/messages/${thread.id}`}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 border-b border-border-subtle/60 px-4 py-3 outline-none transition-colors focus-visible:bg-surface-raised",
          active ? "bg-brand/10" : "hover:bg-surface-raised",
        )}
      >
        <Avatar
          name={thread.counterpart?.displayName ?? "?"}
          src={thread.counterpart?.avatarUrl ?? undefined}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cx(
                "truncate text-sm",
                unread
                  ? "font-semibold text-content-primary"
                  : "font-medium text-content-secondary",
              )}
            >
              {thread.counterpart?.displayName ?? "INKD user"}
            </span>
            {last && (
              <span className="shrink-0 font-mono text-[11px] text-content-muted">
                {formatThreadTimestamp(last.createdAt)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {isAgentDraft && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-content-accent">
                AI
              </span>
            )}
            <p
              className={cx(
                "truncate text-sm",
                unread ? "text-content-primary" : "text-content-muted",
              )}
            >
              {last?.body ?? "No messages yet"}
            </p>
          </div>
        </div>
        {unread && (
          <Badge variant="brand" size="sm" className="shrink-0 px-1.5">
            {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
          </Badge>
        )}
      </Link>
    </li>
  );
}
