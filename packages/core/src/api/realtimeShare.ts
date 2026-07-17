/**
 * Realtime channel dedupe: a topic-keyed registry so multiple hook instances
 * that subscribe to the *same* Supabase Realtime topic share one underlying
 * `RealtimeChannel` instead of each opening their own websocket subscription.
 *
 * Why this exists — two confirmed cases in this codebase where a single
 * mounted component fires more than one hook against the identical topic:
 *   - `NotificationBell` calls both `useUnreadNotificationCount` and
 *     `useNotifications`, which each independently subscribed to
 *     `notifications:${profileId}`.
 *   - `AiStaffView` calls `useAgentActions` twice (once for the proposed
 *     queue, once for the activity feed), each independently subscribing to
 *     `agent_actions:${artistId}`.
 * Supabase does not dedupe `client.channel(topic)` calls — every call opens a
 * distinct subscription, so every row change was firing (and invalidating
 * queries) once per hook instance instead of once per topic. This registry
 * fans one channel's events out to every listener and only tears the channel
 * down once the last listener detaches, keeping subscribeToX's call sites
 * unchanged in shape (subscribe once per hook instance, still get your own
 * unsubscribe) while collapsing the actual network subscriptions to one per
 * topic.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { InkdSupabaseClient } from "../supabase/client";

interface SharedEntry {
  channel: RealtimeChannel;
  listeners: Set<(payload: unknown) => void>;
}

const registry = new Map<string, SharedEntry>();

/**
 * Subscribe to a realtime `topic`, sharing one underlying channel across every
 * caller that requests the same topic. `bind` is invoked only the first time a
 * topic is requested — it should attach `.on(...)` handlers to the given
 * (unsubscribed) channel, call `dispatch` with each event payload, and return
 * the channel after `.subscribe()`. Every `onEvent` passed by later callers
 * for the same topic is fanned the same events without opening a new
 * subscription. Returns an unsubscribe function; the shared channel is
 * removed via `client.removeChannel` once its last listener detaches.
 */
export function subscribeShared<T>(
  client: InkdSupabaseClient,
  topic: string,
  bind: (
    channel: ReturnType<InkdSupabaseClient["channel"]>,
    dispatch: (payload: T) => void,
  ) => RealtimeChannel,
  onEvent: (payload: T) => void,
): () => void {
  let entry = registry.get(topic);
  if (!entry) {
    const listeners = new Set<(payload: unknown) => void>();
    const dispatch = (payload: T) => listeners.forEach((listener) => listener(payload));
    const channel = bind(client.channel(topic), dispatch);
    entry = { channel, listeners };
    registry.set(topic, entry);
  }
  const listener = onEvent as (payload: unknown) => void;
  entry.listeners.add(listener);
  return () => {
    entry!.listeners.delete(listener);
    if (entry!.listeners.size === 0) {
      void client.removeChannel(entry!.channel);
      registry.delete(topic);
    }
  };
}
