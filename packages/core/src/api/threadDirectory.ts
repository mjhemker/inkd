/**
 * Data access: thread-list "directory" view — threads joined with the other
 * participant's display info, a last-message preview, and an unread count.
 * Built on top of the primitives in `./messaging`; kept in its own file so
 * `messaging.ts` (owned by the P1 wave) stays untouched (SPEC §4 in-app chat,
 * §5 agent-authored messages).
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { Message, SenderKind, Thread } from "../types/rows";
import { getThread, listArtistThreads, listClientThreads } from "./messaging";
import { unwrapList } from "./helpers";

export interface ThreadCounterpart {
  /** Always a `profiles.id` — the person on the other side of the thread. */
  profileId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

export interface ThreadLastMessage {
  body: string | null;
  senderKind: SenderKind;
  draftedByAgent: boolean;
  createdAt: string;
}

export interface ThreadSummary extends Thread {
  /** "client" if the current viewer is the client side of this thread, else "artist". */
  myRole: "client" | "artist";
  counterpart: ThreadCounterpart | null;
  lastMessage: ThreadLastMessage | null;
  unreadCount: number;
}

interface DirectoryParams {
  /** The current viewer's `profiles.id`. */
  profileId: string;
  /** The current viewer's `artist_profiles.id`, if they have one. */
  artistProfileId?: string | null;
}

/**
 * All threads the current viewer participates in — as a client and (if they
 * have an artist profile) as an artist — merged, enriched, and sorted by most
 * recent activity first.
 */
export async function listMyThreadSummaries(
  client: InkdSupabaseClient,
  { profileId, artistProfileId }: DirectoryParams,
): Promise<ThreadSummary[]> {
  const [asClient, asArtist] = await Promise.all([
    listClientThreads(client, profileId),
    artistProfileId ? listArtistThreads(client, artistProfileId) : Promise.resolve([]),
  ]);

  const byId = new Map<string, Thread>();
  for (const t of asClient) byId.set(t.id, t);
  for (const t of asArtist) byId.set(t.id, t);
  const threads = [...byId.values()];
  if (threads.length === 0) return [];

  const threadIds = threads.map((t) => t.id);
  const clientProfileIds = [...new Set(threads.map((t) => t.client_id))];
  const artistProfileIds = [...new Set(threads.map((t) => t.artist_id))];

  const [clientProfiles, artistOwners, lastMessages, unreadRows] = await Promise.all([
    fetchProfilesByIds(client, clientProfileIds),
    fetchArtistOwnersByIds(client, artistProfileIds),
    fetchLastMessagesByThread(client, threadIds),
    fetchUnreadMessages(client, threadIds),
  ]);

  const summaries: ThreadSummary[] = threads.map((thread) => {
    const myRole: "client" | "artist" =
      thread.client_id === profileId ? "client" : "artist";
    const counterpart: ThreadCounterpart | null =
      myRole === "client"
        ? artistOwners.get(thread.artist_id) ?? null
        : clientProfiles.get(thread.client_id) ?? null;
    const last = lastMessages.get(thread.id) ?? null;
    const mineSenderKinds: SenderKind[] =
      myRole === "client" ? ["client"] : ["artist", "agent"];
    const unreadCount = (unreadRows.get(thread.id) ?? []).filter(
      (m) => !mineSenderKinds.includes(m.sender_kind),
    ).length;

    return {
      ...thread,
      myRole,
      counterpart,
      lastMessage: last,
      unreadCount,
    };
  });

  summaries.sort((a, b) => {
    const at = a.last_message_at ?? a.created_at;
    const bt = b.last_message_at ?? b.created_at;
    return bt.localeCompare(at);
  });

  return summaries;
}

/** Single-thread version of `listMyThreadSummaries`, for the chat screen header. */
export async function getThreadSummary(
  client: InkdSupabaseClient,
  threadId: string,
  profileId: string,
): Promise<ThreadSummary | null> {
  const thread = await getThread(client, threadId);
  if (!thread) return null;

  const myRole: "client" | "artist" = thread.client_id === profileId ? "client" : "artist";
  const [counterpartMap, lastMessageMap, unreadMap] = await Promise.all([
    myRole === "client"
      ? fetchArtistOwnersByIds(client, [thread.artist_id])
      : fetchProfilesByIds(client, [thread.client_id]),
    fetchLastMessagesByThread(client, [thread.id]),
    fetchUnreadMessages(client, [thread.id]),
  ]);
  const counterpartId = myRole === "client" ? thread.artist_id : thread.client_id;
  const mineSenderKinds: SenderKind[] = myRole === "client" ? ["client"] : ["artist", "agent"];
  const unreadCount = (unreadMap.get(thread.id) ?? []).filter(
    (m) => !mineSenderKinds.includes(m.sender_kind),
  ).length;

  return {
    ...thread,
    myRole,
    counterpart: counterpartMap.get(counterpartId) ?? null,
    lastMessage: lastMessageMap.get(thread.id) ?? null,
    unreadCount,
  };
}

async function fetchProfilesByIds(
  client: InkdSupabaseClient,
  ids: string[],
): Promise<Map<string, ThreadCounterpart>> {
  const map = new Map<string, ThreadCounterpart>();
  if (ids.length === 0) return map;
  const rows = unwrapList(
    await client
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .in("id", ids),
  );
  for (const r of rows) {
    map.set(r.id, {
      profileId: r.id,
      displayName: r.display_name ?? "INKD user",
      handle: r.handle,
      avatarUrl: r.avatar_url,
    });
  }
  return map;
}

async function fetchArtistOwnersByIds(
  client: InkdSupabaseClient,
  artistProfileIds: string[],
): Promise<Map<string, ThreadCounterpart>> {
  const map = new Map<string, ThreadCounterpart>();
  if (artistProfileIds.length === 0) return map;
  const rows = unwrapList(
    await client
      .from("artist_profiles")
      .select("id, profile_id, profiles(display_name, handle, avatar_url)")
      .in("id", artistProfileIds),
  ) as {
    id: string;
    profile_id: string;
    profiles: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
  }[];
  for (const r of rows) {
    map.set(r.id, {
      profileId: r.profile_id,
      displayName: r.profiles?.display_name ?? "INKD artist",
      handle: r.profiles?.handle ?? null,
      avatarUrl: r.profiles?.avatar_url ?? null,
    });
  }
  return map;
}

async function fetchLastMessagesByThread(
  client: InkdSupabaseClient,
  threadIds: string[],
): Promise<Map<string, ThreadLastMessage>> {
  const map = new Map<string, ThreadLastMessage>();
  if (threadIds.length === 0) return map;
  const rows = unwrapList(
    await client
      .from("messages")
      .select("thread_id, body, sender_kind, drafted_by_agent, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  );
  for (const r of rows) {
    if (map.has(r.thread_id)) continue;
    map.set(r.thread_id, {
      body: r.body,
      senderKind: r.sender_kind,
      draftedByAgent: r.drafted_by_agent,
      createdAt: r.created_at,
    });
  }
  return map;
}

async function fetchUnreadMessages(
  client: InkdSupabaseClient,
  threadIds: string[],
): Promise<Map<string, Pick<Message, "sender_kind">[]>> {
  const map = new Map<string, Pick<Message, "sender_kind">[]>();
  if (threadIds.length === 0) return map;
  const rows = unwrapList(
    await client
      .from("messages")
      .select("thread_id, sender_kind")
      .in("thread_id", threadIds)
      .eq("is_read", false),
  );
  for (const r of rows) {
    const list = map.get(r.thread_id) ?? [];
    list.push({ sender_kind: r.sender_kind });
    map.set(r.thread_id, list);
  }
  return map;
}
