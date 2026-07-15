/** Hooks: thread messages with live Realtime updates + send mutation. */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listMessages,
  sendMessage,
  subscribeToThreadMessages,
} from "../api/messaging";
import type { Message } from "../types/rows";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

/**
 * Live-updating message list for a thread. Fetches history via TanStack Query
 * and appends new rows pushed over Realtime (RLS-scoped to participants).
 */
export function useThreadMessages(threadId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const key = queryKeys.threadMessages(threadId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => listMessages(client, threadId),
    enabled: Boolean(threadId),
  });

  useEffect(() => {
    if (!threadId) return;
    const channel = subscribeToThreadMessages(client, threadId, (incoming) => {
      qc.setQueryData<Message[]>(key, (prev) => {
        if (!prev) return [incoming];
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    });
    return () => {
      void client.removeChannel(channel);
    };
    // `key` and `qc` are stable for a given threadId; re-subscribe only when the
    // client or thread changes.
  }, [client, threadId, qc]);

  return query;
}

export function useSendMessage(threadId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof sendMessage>[1]) =>
      sendMessage(client, input),
    onSuccess: (message: Message) => {
      qc.setQueryData<Message[]>(
        queryKeys.threadMessages(threadId),
        (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        },
      );
    },
  });
}
