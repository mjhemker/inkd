/**
 * Discovery-feed hooks (SPEC §4): a paginated/infinite feed query plus the
 * like / save / follow mutations, each with optimistic cache updates applied
 * across every feed query at once.
 *
 * Shared by web (Next.js) and mobile (Expo) — screens stay thin and just render
 * `FeedItem`s and wire buttons to these mutations.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  listFeedItems,
  type FeedArtistFilters,
  type FeedItem,
  type FeedScope,
} from "../api/feed";
import { listStyles } from "../api/artistProfiles";
import {
  setArtistFollowed,
  setPostLiked,
  setPostSaved,
} from "../api/social";
import { getCurrentProfile } from "../auth/role";
import { useInkdClient } from "./context";
import { feedQueryKeys } from "./queryKeysFeed";
import { contentQueryKeys } from "./queryKeysExtras";

const PAGE_SIZE = 12;

/** The current viewer's profile id (auth.uid()), or null when signed out. */
function useViewerId(): { viewerId: string | null; isLoading: boolean } {
  const client = useInkdClient();
  const { data, isLoading } = useQuery({
    queryKey: ["currentProfile"],
    queryFn: () => getCurrentProfile(client),
  });
  return { viewerId: data?.id ?? null, isLoading };
}

export interface UseFeedOptions {
  /** Single style chip (quick filter). */
  styleSlug?: string | null;
  /** Filter-panel multi-select styles (post_styles). */
  styleSlugs?: string[];
  /** Filter-panel "Other" free-text style query (matched in JS — see `listFeedItems`). */
  styleQuery?: string;
  /** Filter-panel artist-level filters (location / price / books / state). */
  artistFilters?: FeedArtistFilters;
  /** Skip the query (e.g. while auth is still resolving). */
  enabled?: boolean;
}

/**
 * Infinite feed for a scope. Pages are `FeedItem[]`; a page shorter than
 * `PAGE_SIZE` ends the stream. The style chip filter, the panel filters, and
 * the viewer id are all part of the key so switching any refetches cleanly.
 */
export function useFeed(scope: FeedScope, options: UseFeedOptions = {}) {
  const client = useInkdClient();
  const { viewerId, isLoading: viewerLoading } = useViewerId();
  const styleSlug = options.styleSlug ?? null;
  const styleSlugs = options.styleSlugs ?? [];
  const styleQuery = options.styleQuery?.trim() || undefined;
  const artistFilters = options.artistFilters;

  return useInfiniteQuery({
    queryKey: feedQueryKeys.list(scope, styleSlug, viewerId, { styleSlugs, styleQuery, artistFilters }),
    enabled: (options.enabled ?? true) && !viewerLoading,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listFeedItems(client, {
        scope,
        viewerId,
        styleSlug: styleSlug ?? undefined,
        styleSlugs: styleSlugs.length ? styleSlugs : undefined,
        styleQuery,
        artistFilters,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      // Only posts paginate; a short page (fewer than PAGE_SIZE posts) is the end.
      const lastPostCount = lastPage.filter((i) => i.kind === "post").length;
      if (lastPostCount < PAGE_SIZE) return undefined;
      return allPages.reduce(
        (n, page) => n + page.filter((i) => i.kind === "post").length,
        0,
      );
    },
  });
}

/** Flattened convenience: all loaded items across pages. */
export function useFeedItems(scope: FeedScope, options: UseFeedOptions = {}) {
  const query = useFeed(scope, options);
  const items = (query.data?.pages ?? []).flat();
  return { ...query, items };
}

/** The style taxonomy for the filter chip row. */
export function useStyleFilters() {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.styles(),
    queryFn: () => listStyles(client),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Optimistic cache patching
// ---------------------------------------------------------------------------

type FeedData = InfiniteData<FeedItem[], number>;

/** Apply a per-item transform to every feed query currently in cache. */
function patchAllFeeds(
  qc: ReturnType<typeof useQueryClient>,
  transform: (item: FeedItem) => FeedItem,
) {
  qc.setQueriesData<FeedData>({ queryKey: feedQueryKeys.all() }, (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => page.map(transform)),
    };
  });
}

function useViewerIdOrThrow(): string | null {
  return useViewerId().viewerId;
}

export function useToggleLike() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const viewerId = useViewerIdOrThrow();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!viewerId) throw new Error("Sign in to like posts.");
      return setPostLiked(client, viewerId, postId, liked);
    },
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: feedQueryKeys.all() });
      patchAllFeeds(qc, (item) =>
        item.kind === "post" && item.id === postId
          ? {
              ...item,
              likedByViewer: liked,
              likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
            }
          : item,
      );
    },
    onError: (_e, { postId, liked }) => {
      // Roll back by inverting the optimistic change.
      patchAllFeeds(qc, (item) =>
        item.kind === "post" && item.id === postId
          ? {
              ...item,
              likedByViewer: !liked,
              likeCount: Math.max(0, item.likeCount + (liked ? -1 : 1)),
            }
          : item,
      );
    },
  });
}

export function useToggleSave() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const viewerId = useViewerIdOrThrow();
  return useMutation({
    mutationFn: ({ postId, saved }: { postId: string; saved: boolean }) => {
      if (!viewerId) throw new Error("Sign in to save posts.");
      return setPostSaved(client, viewerId, postId, saved);
    },
    onMutate: async ({ postId, saved }) => {
      await qc.cancelQueries({ queryKey: feedQueryKeys.all() });
      patchAllFeeds(qc, (item) =>
        item.kind === "post" && item.id === postId
          ? { ...item, savedByViewer: saved }
          : item,
      );
    },
    onError: (_e, { postId, saved }) => {
      patchAllFeeds(qc, (item) =>
        item.kind === "post" && item.id === postId
          ? { ...item, savedByViewer: !saved }
          : item,
      );
    },
  });
}

export function useToggleFollow() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const viewerId = useViewerIdOrThrow();
  return useMutation({
    mutationFn: ({ artistId, followed }: { artistId: string; followed: boolean }) => {
      if (!viewerId) throw new Error("Sign in to follow artists.");
      return setArtistFollowed(client, viewerId, artistId, followed);
    },
    onMutate: async ({ artistId, followed }) => {
      await qc.cancelQueries({ queryKey: feedQueryKeys.all() });
      patchAllFeeds(qc, (item) =>
        item.artist.artistId === artistId
          ? { ...item, artist: { ...item.artist, isFollowedByViewer: followed } }
          : item,
      );
    },
    onError: (_e, { artistId, followed }) => {
      patchAllFeeds(qc, (item) =>
        item.artist.artistId === artistId
          ? { ...item, artist: { ...item.artist, isFollowedByViewer: !followed } }
          : item,
      );
    },
    onSettled: () => {
      // The "following" scope's membership actually changed — refetch it.
      qc.invalidateQueries({ queryKey: feedQueryKeys.all() });
    },
  });
}
