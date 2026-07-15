/**
 * Hooks: the thread "directory" (list screen) — live-updating summaries, plus
 * the start/find-or-create-a-thread mutation behind `/messages/new`.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getThreadSummary,
  listMyThreadSummaries,
  type ThreadSummary,
} from "../api/threadDirectory";
import { resolveAndStartThread, type ResolveThreadParams } from "../api/threadStarter";
import { subscribeToThreadMessages } from "../api/messaging";
import type { SenderKind } from "../types/rows";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

/**
 * Live-updating thread list for the current viewer (client threads + artist
 * threads, merged). Backfills history via TanStack Query, then patches
 * previews/unread counts in place as Realtime pushes new messages in any of
 * the visible threads.
 */
export function useThreadSummaries(
  profileId: string | undefined,
  artistProfileId?: string | null,
) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const key = queryKeys.threadSummaries(profileId ?? "", artistProfileId);

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      listMyThreadSummaries(client, {
        profileId: profileId as string,
        artistProfileId,
      }),
    enabled: Boolean(profileId),
  });

  const threadIds = (query.data ?? []).map((t) => t.id);
  const idsSignature = threadIds.join(",");

  useEffect(() => {
    if (!profileId || threadIds.length === 0) return;
    const channels = threadIds.map((threadId) =>
      subscribeToThreadMessages(client, threadId, (message) => {
        qc.setQueryData<ThreadSummary[]>(key, (prev) => {
          if (!prev) return prev;
          const next = prev.map((t) => {
            if (t.id !== message.thread_id) return t;
            const mineSenderKinds: SenderKind[] =
              t.myRole === "client" ? ["client"] : ["artist", "agent"];
            const isMine = mineSenderKinds.includes(message.sender_kind);
            return {
              ...t,
              last_message_at: message.created_at,
              lastMessage: {
                body: message.body,
                senderKind: message.sender_kind,
                draftedByAgent: message.drafted_by_agent,
                createdAt: message.created_at,
              },
              unreadCount: isMine ? t.unreadCount : t.unreadCount + 1,
            };
          });
          next.sort((a, b) =>
            (b.last_message_at ?? b.created_at).localeCompare(
              a.last_message_at ?? a.created_at,
            ),
          );
          return next;
        });
      }),
    );
    return () => {
      channels.forEach((ch) => void client.removeChannel(ch));
    };
    // `key`/`qc` are stable for a given profile+artist pair; re-subscribe only
    // when the client or the visible thread-id set changes (intentionally
    // omitting `key`/`qc`/`threadIds` from the dep array below).
  }, [client, profileId, idsSignature]);

  return query;
}

/** A single thread's summary (counterpart identity, etc.) for the chat header. */
export function useThreadSummary(threadId: string | undefined, profileId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["threadSummary", threadId, profileId] as const,
    queryFn: () => getThreadSummary(client, threadId as string, profileId as string),
    enabled: Boolean(threadId) && Boolean(profileId),
  });
}

/** Find-or-create the thread with a given profile (`/messages/new?to=`). */
export function useStartThread() {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ResolveThreadParams) => resolveAndStartThread(client, params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["threadSummaries"] });
    },
  });
}
