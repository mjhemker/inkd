/**
 * Daily Drop hooks (founder §engagement): today's personalized pick, the recent
 * history strip, and the engagement loop (seen / clicked / react). Shared by web
 * + mobile — screens stay thin and render a `DailyDropCard`.
 *
 * Reactions (like/save) run through the same `social` mutations the feed uses,
 * so a reaction both updates the post AND feeds back into the user's
 * `user_style_affinity` for tomorrow's drop. They optimistically patch every
 * daily-drop query and invalidate the feed so the two surfaces stay consistent.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDropHistory,
  getTodayDrop,
  markDropClicked,
  markDropSeen,
  reactToDrop,
  type DailyDropCard,
} from "../api/dailyDrop";
import { getCurrentProfile } from "../auth/role";
import { useInkdClient } from "./context";
import { dailyDropQueryKeys } from "./queryKeysDailyDrop";
import { feedQueryKeys } from "./queryKeysFeed";

/** Today's UTC calendar date — the drop day (matches the generator). */
export function todayDropDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function useViewerId(): { viewerId: string | null; isLoading: boolean } {
  const client = useInkdClient();
  const { data, isLoading } = useQuery({
    queryKey: ["currentProfile"],
    queryFn: () => getCurrentProfile(client),
  });
  return { viewerId: data?.id ?? null, isLoading };
}

export interface UseDailyDropOptions {
  enabled?: boolean;
}

/** Today's drop card (or null when none generated yet / signed out). */
export function useTodayDrop(options: UseDailyDropOptions = {}) {
  const client = useInkdClient();
  const { viewerId, isLoading: viewerLoading } = useViewerId();
  const date = todayDropDate();
  return useQuery({
    queryKey: dailyDropQueryKeys.today(viewerId, date),
    enabled: (options.enabled ?? true) && !viewerLoading && !!viewerId,
    queryFn: () => (viewerId ? getTodayDrop(client, viewerId, { date }) : Promise.resolve(null)),
  });
}

/** Recent drops (newest first) for the "yesterday's drops" history strip. */
export function useDropHistory(options: UseDailyDropOptions & { limit?: number } = {}) {
  const client = useInkdClient();
  const { viewerId, isLoading: viewerLoading } = useViewerId();
  return useQuery({
    queryKey: dailyDropQueryKeys.history(viewerId),
    enabled: (options.enabled ?? true) && !viewerLoading && !!viewerId,
    queryFn: () =>
      viewerId ? getDropHistory(client, viewerId, { limit: options.limit }) : Promise.resolve([]),
  });
}

// ---------------------------------------------------------------------------
// Engagement loop
// ---------------------------------------------------------------------------
function patchDropCards(
  qc: ReturnType<typeof useQueryClient>,
  transform: (card: DailyDropCard) => DailyDropCard,
) {
  qc.setQueriesData<DailyDropCard | DailyDropCard[] | null>(
    { queryKey: dailyDropQueryKeys.all() },
    (data) => {
      if (!data) return data;
      if (Array.isArray(data)) return data.map(transform);
      return transform(data);
    },
  );
}

/** Stamp the drop seen (fire-and-forget when the card first renders). */
export function useMarkDropSeen() {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dropId: string) => markDropSeen(client, dropId),
    onMutate: (dropId) => {
      const now = new Date().toISOString();
      patchDropCards(qc, (c) => (c.id === dropId && !c.seenAt ? { ...c, seenAt: now } : c));
    },
  });
}

/** Stamp the drop clicked (e.g. when the user opens the artist / books). */
export function useMarkDropClicked() {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dropId: string) => markDropClicked(client, dropId),
    onMutate: (dropId) => {
      const now = new Date().toISOString();
      patchDropCards(qc, (c) => (c.id === dropId && !c.clickedAt ? { ...c, clickedAt: now } : c));
    },
  });
}

export interface ReactArgs {
  dropId: string;
  postId: string;
  action: "like" | "save";
  on: boolean;
}

/** Like/save a post drop — feeds back into affinity + updates both surfaces. */
export function useDropReact() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const { viewerId } = useViewerId();
  return useMutation({
    mutationFn: ({ dropId, postId, action, on }: ReactArgs) => {
      if (!viewerId) throw new Error("Sign in to react to your drop.");
      return reactToDrop(client, { dropId, profileId: viewerId, postId, action, on });
    },
    onMutate: ({ dropId, action, on }) => {
      const now = new Date().toISOString();
      patchDropCards(qc, (c) => {
        if (c.id !== dropId || !c.post) return c;
        const post = { ...c.post };
        if (action === "like") {
          post.likedByViewer = on;
          post.likeCount = Math.max(0, post.likeCount + (on ? 1 : -1));
        } else {
          post.savedByViewer = on;
        }
        return { ...c, post, reactedAt: on ? (c.reactedAt ?? now) : c.reactedAt };
      });
    },
    onError: (_err, { dropId, action, on }) => {
      patchDropCards(qc, (c) => {
        if (c.id !== dropId || !c.post) return c;
        const post = { ...c.post };
        if (action === "like") {
          post.likedByViewer = !on;
          post.likeCount = Math.max(0, post.likeCount + (on ? -1 : 1));
        } else {
          post.savedByViewer = !on;
        }
        return { ...c, post };
      });
    },
    onSettled: () => {
      // The reaction changed the post's like/save state — keep the feed in sync.
      qc.invalidateQueries({ queryKey: feedQueryKeys.all() });
    },
  });
}
