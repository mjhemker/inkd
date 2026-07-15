/**
 * Data access: threads + messages, plus a realtime subscription helper for live
 * chat (SPEC §4 in-app chat / §5 agent-authored messages).
 */
import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  Thread,
  ThreadInsert,
  Message,
  MessageInsert,
} from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";

// --- threads ----------------------------------------------------------------
/** Threads for an artist's inbox, most-recently-active first. */
export async function listArtistThreads(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<Thread[]> {
  return unwrapList(
    await client
      .from("threads")
      .select("*")
      .eq("artist_id", artistId)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
  );
}

/** Threads the current client participates in. */
export async function listClientThreads(
  client: InkdSupabaseClient,
  clientId: string,
): Promise<Thread[]> {
  return unwrapList(
    await client
      .from("threads")
      .select("*")
      .eq("client_id", clientId)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
  );
}

export async function getThread(
  client: InkdSupabaseClient,
  id: string,
): Promise<Thread | null> {
  return unwrapMaybe(
    await client.from("threads").select("*").eq("id", id).maybeSingle(),
  );
}

const createThreadSchema = z.object({
  artist_id: z.string().uuid(),
  client_id: z.string().uuid(),
  booking_request_id: z.string().uuid().nullable().optional(),
  booking_id: z.string().uuid().nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
});

export async function createThread(
  client: InkdSupabaseClient,
  input: z.input<typeof createThreadSchema>,
): Promise<Thread> {
  const fields = createThreadSchema.parse(input) as ThreadInsert;
  return unwrap(
    await client.from("threads").insert(fields).select("*").single(),
  );
}

// --- messages ---------------------------------------------------------------
/** Messages in a thread, oldest first (chat display order). */
export async function listMessages(
  client: InkdSupabaseClient,
  threadId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<Message[]> {
  let query = client
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (opts.before) query = query.lt("created_at", opts.before);
  if (opts.limit) query = query.limit(opts.limit);
  return unwrapList(await query);
}

const sendMessageSchema = z.object({
  thread_id: z.string().uuid(),
  sender_kind: z.enum(["client", "artist", "agent"]),
  sender_profile_id: z.string().uuid().nullable().optional(),
  body: z.string().max(8000).nullable().optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
});

/**
 * Post a message. The caller sets `sender_kind` + `sender_profile_id` (agent
 * messages are written server-side). Also bumps the thread's `last_message_at`.
 */
export async function sendMessage(
  client: InkdSupabaseClient,
  input: z.input<typeof sendMessageSchema>,
): Promise<Message> {
  const fields = sendMessageSchema.parse(input);
  const insert: MessageInsert = {
    ...fields,
    attachments: fields.attachments as MessageInsert["attachments"],
  };
  const message = unwrap(
    await client.from("messages").insert(insert).select("*").single(),
  );
  // Best-effort recency bump; ignore RLS/no-op failures.
  await client
    .from("threads")
    .update({ last_message_at: message.created_at })
    .eq("id", fields.thread_id);
  return message;
}

export async function markMessageRead(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Subscribe to new messages in a thread over Realtime. Returns the channel;
 * call `client.removeChannel(channel)` (or `channel.unsubscribe()`) to tear
 * down. Realtime respects RLS, so only thread participants receive rows.
 *
 * @example
 *   const channel = subscribeToThreadMessages(supabase, threadId, (m) => {...});
 *   // later: supabase.removeChannel(channel);
 */
export function subscribeToThreadMessages(
  client: InkdSupabaseClient,
  threadId: string,
  onMessage: (message: Message) => void,
): RealtimeChannel {
  return client
    .channel(`thread:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
}
