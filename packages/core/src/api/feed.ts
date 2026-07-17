/**
 * Discovery feed data access (SPEC §4 — client discovery).
 *
 * The feed is a style-tagged stream that mixes portfolio `posts` and `flash`
 * drops from published artists. Two scopes:
 *   - "following" — only artists the viewer follows, newest-first.
 *   - "discover"  — every public artist, newest-first with a simple, DETERMINISTIC
 *                   style-affinity boost (see `rankFeedItems`).
 *
 * Composition, not deep PostgREST joins: like `usePublicArtistProfile`, each
 * page runs a few narrow RLS-scoped reads and assembles the shape in JS. This
 * keeps the queries legible, avoids RLS-recursion foot-guns, and works against
 * the offline preview harness's mock client (which does not implement embedded
 * joins / server-side ordering).
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  ArtistProfile,
  FlashItem,
  Post,
  Profile,
  Style,
  UsState,
} from "../types/rows";
import { clampLimit, unwrapList } from "./helpers";

/**
 * Artist-level feed filters (the filter panel's location / price / books-open /
 * state). Resolved server-side to a set of eligible published-artist ids by the
 * `feed_filter_artist_ids` RPC, which the feed then intersects with its
 * candidate posts. Styles are NOT here — they filter at the POST level (see
 * `styleSlugs`) so the panel stays in sync with the style chip row.
 */
export interface FeedArtistFilters {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  priceMinCents?: number;
  priceMaxCents?: number;
  booksOpen?: boolean;
  state?: UsState;
}

/** True when any artist-level filter is set (i.e. the RPC prefilter must run). */
export function hasFeedArtistFilters(f: FeedArtistFilters | undefined): boolean {
  if (!f) return false;
  return (
    f.lat != null ||
    f.lng != null ||
    f.priceMinCents != null ||
    f.priceMaxCents != null ||
    f.booksOpen === true ||
    f.state != null
  );
}

// ---------------------------------------------------------------------------
// Public feed types (the assembled card shapes the UI renders).
// ---------------------------------------------------------------------------

/** The artist byline shared by every feed card's museum placard. */
export interface FeedArtist {
  artistId: string;
  profileId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  /** artist_profiles.styles — free-text style names for the placard. */
  styles: string[];
  /** Books-open signal (artist_profiles.accepts_new_clients). */
  acceptsNewClients: boolean;
  /** Whether the current viewer follows this artist. */
  isFollowedByViewer: boolean;
}

export interface FeedStyleTag {
  id: string;
  slug: string;
  name: string;
}

export interface FeedPostItem {
  kind: "post";
  /** Stable feed key — `post:<id>`. */
  key: string;
  id: string;
  createdAt: string;
  coverUrl: string | null;
  caption: string | null;
  styleTags: FeedStyleTag[];
  likeCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  artist: FeedArtist;
}

export interface FeedFlashItem {
  kind: "flash";
  /** Stable feed key — `flash:<id>`. */
  key: string;
  id: string;
  flashSheetId: string;
  createdAt: string;
  imageUrl: string | null;
  title: string | null;
  priceCents: number | null;
  isAvailable: boolean;
  isRepeatable: boolean;
  placementSuggestion: string | null;
  sizeInches: number | null;
  /** Flash cards inherit the artist's style names for the placard. */
  styleTags: FeedStyleTag[];
  artist: FeedArtist;
}

export type FeedItem = FeedPostItem | FeedFlashItem;

export type FeedScope = "following" | "discover";

// ---------------------------------------------------------------------------
// Social-graph reads
// ---------------------------------------------------------------------------

/** artist_profiles.id values the given profile follows. */
export async function listFollowedArtistIds(
  client: InkdSupabaseClient,
  followerId: string,
): Promise<string[]> {
  const rows = unwrapList(
    await client.from("follows").select("artist_id").eq("follower_id", followerId),
  ) as { artist_id: string }[];
  return rows.map((r) => r.artist_id);
}

/**
 * The viewer's style affinity — the distinct style ids tagged on posts by the
 * artists they follow. Deterministic and self-consistent with what the feed
 * displays; drives the "discover" boost. Empty when the viewer follows nobody.
 */
async function getViewerAffinityStyleIds(
  client: InkdSupabaseClient,
  followedArtistIds: string[],
): Promise<Set<string>> {
  if (followedArtistIds.length === 0) return new Set();
  const rows = unwrapList(
    await client
      .from("post_styles")
      .select("style_id")
      .in("artist_id", followedArtistIds),
  ) as { style_id: string }[];
  return new Set(rows.map((r) => r.style_id));
}

// ---------------------------------------------------------------------------
// Candidate reads (raw rows) + hydration
// ---------------------------------------------------------------------------

async function listCandidatePosts(
  client: InkdSupabaseClient,
  opts: { artistIds?: string[]; postIds?: string[]; limit: number; offset: number },
): Promise<Post[]> {
  let query = client
    .from("posts")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.artistIds) query = query.in("artist_id", opts.artistIds);
  if (opts.postIds) query = query.in("id", opts.postIds);
  return unwrapList(await query);
}

async function listCandidateFlashItems(
  client: InkdSupabaseClient,
  opts: { artistIds?: string[]; limit: number },
): Promise<FlashItem[]> {
  let query = client
    .from("flash_items")
    .select("*")
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .range(0, opts.limit - 1);
  if (opts.artistIds) query = query.in("artist_id", opts.artistIds);
  return unwrapList(await query);
}

interface HydrationContext {
  artistsById: Map<string, ArtistProfile>;
  profilesById: Map<string, Profile>;
  followedArtistIds: Set<string>;
}

/** Batch-load the artist_profiles + profiles + follow state for a set of artist ids. */
async function loadHydrationContext(
  client: InkdSupabaseClient,
  artistIds: string[],
  followedArtistIds: Set<string>,
): Promise<HydrationContext> {
  const uniqueArtistIds = [...new Set(artistIds)];
  const artists =
    uniqueArtistIds.length === 0
      ? []
      : (unwrapList(
          await client.from("artist_profiles").select("*").in("id", uniqueArtistIds),
        ) as ArtistProfile[]);
  const artistsById = new Map(artists.map((a) => [a.id, a]));
  const profileIds = [...new Set(artists.map((a) => a.profile_id))];
  const profiles =
    profileIds.length === 0
      ? []
      : (unwrapList(
          await client.from("profiles").select("*").in("id", profileIds),
        ) as Profile[]);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  return { artistsById, profilesById, followedArtistIds };
}

function toFeedArtist(
  artist: ArtistProfile,
  ctx: HydrationContext,
): FeedArtist | null {
  const profile = ctx.profilesById.get(artist.profile_id);
  if (!profile) return null;
  return {
    artistId: artist.id,
    profileId: profile.id,
    handle: profile.handle,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    city: profile.city,
    state: profile.state,
    styles: artist.styles ?? [],
    acceptsNewClients: artist.accepts_new_clients,
    isFollowedByViewer: ctx.followedArtistIds.has(artist.id),
  };
}

/** style_id -> {slug,name} for a set of post ids (normalized post_styles join). */
async function loadPostStyleTags(
  client: InkdSupabaseClient,
  postIds: string[],
): Promise<{ byPostId: Map<string, FeedStyleTag[]>; styleIdsByPostId: Map<string, string[]> }> {
  const byPostId = new Map<string, FeedStyleTag[]>();
  const styleIdsByPostId = new Map<string, string[]>();
  if (postIds.length === 0) return { byPostId, styleIdsByPostId };
  const links = unwrapList(
    await client.from("post_styles").select("post_id, style_id").in("post_id", postIds),
  ) as { post_id: string; style_id: string }[];
  const styleIds = [...new Set(links.map((l) => l.style_id))];
  const styles =
    styleIds.length === 0
      ? []
      : (unwrapList(
          await client.from("styles").select("*").in("id", styleIds),
        ) as Style[]);
  const styleById = new Map(styles.map((s) => [s.id, s]));
  for (const link of links) {
    const style = styleById.get(link.style_id);
    if (!style) continue;
    const tag: FeedStyleTag = { id: style.id, slug: style.slug, name: style.name };
    (byPostId.get(link.post_id) ?? byPostId.set(link.post_id, []).get(link.post_id)!).push(tag);
    (styleIdsByPostId.get(link.post_id) ??
      styleIdsByPostId.set(link.post_id, []).get(link.post_id)!).push(style.id);
  }
  return { byPostId, styleIdsByPostId };
}

/** Which of the given post ids the viewer has liked. */
async function loadViewerLikes(
  client: InkdSupabaseClient,
  viewerId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set();
  const rows = unwrapList(
    await client
      .from("post_likes")
      .select("post_id")
      .eq("profile_id", viewerId)
      .in("post_id", postIds),
  ) as { post_id: string }[];
  return new Set(rows.map((r) => r.post_id));
}

/** Which of the given post ids the viewer has saved. */
async function loadViewerSaves(
  client: InkdSupabaseClient,
  viewerId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set();
  const rows = unwrapList(
    await client
      .from("saved_posts")
      .select("post_id")
      .eq("profile_id", viewerId)
      .in("post_id", postIds),
  ) as { post_id: string }[];
  return new Set(rows.map((r) => r.post_id));
}

// ---------------------------------------------------------------------------
// Ranking — deliberately simple + deterministic (SPEC: "keep ranking simple").
// ---------------------------------------------------------------------------

/**
 * Discover ranking. Two-key sort, fully deterministic:
 *   1. affinity tier DESC — items sharing any style with the viewer's affinity
 *      set (styles of the artists they follow) float above the rest. This is the
 *      whole "style-affinity boost": a single boolean bump, never a fuzzy score.
 *   2. recency DESC (created_at), with post id as a stable final tiebreak.
 *
 * With no affinity (signed-out or following nobody) every item is tier 0, so
 * this collapses to a pure newest-first stream.
 */
export function rankFeedItems(
  items: FeedItem[],
  affinityStyleIds: Set<string>,
  itemStyleIds: Map<string, string[]>,
): FeedItem[] {
  const tierOf = (item: FeedItem): number => {
    if (affinityStyleIds.size === 0) return 0;
    const ids = itemStyleIds.get(item.key) ?? [];
    return ids.some((id) => affinityStyleIds.has(id)) ? 1 : 0;
  };
  return [...items].sort((a, b) => {
    const tierDelta = tierOf(b) - tierOf(a);
    if (tierDelta !== 0) return tierDelta;
    const timeDelta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------

const feedParamsSchema = z.object({
  scope: z.enum(["following", "discover"]).default("discover"),
  // The viewer id is whatever auth.uid() returns (a uuid in prod); we only
  // require a non-empty string so tests/preview harnesses can use readable ids.
  viewerId: z.string().min(1).nullable().optional(),
  // Single style chip (legacy/quick filter) and the panel's multi-select. Both
  // filter posts by post_styles; when both are present they union.
  styleSlug: z.string().optional(),
  styleSlugs: z.array(z.string().min(1)).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type ListFeedParams = z.input<typeof feedParamsSchema> & {
  /** Artist-level filters (resolved via `feed_filter_artist_ids`). */
  artistFilters?: FeedArtistFilters;
};

/**
 * One page of the assembled feed. Posts paginate through `offset`/`limit`;
 * flash drops (few, always-fresh) are merged in on the first page only so they
 * surface near the top without duplicating as the viewer pages down.
 */
export async function listFeedItems(
  client: InkdSupabaseClient,
  params: ListFeedParams = {},
): Promise<FeedItem[]> {
  const { artistFilters } = params;
  const { scope, viewerId, styleSlug, styleSlugs, limit, offset } =
    feedParamsSchema.parse(params);
  const pageSize = clampLimit(limit, 12);
  const pageOffset = offset ?? 0;
  const viewer = viewerId ?? null;

  // The effective post-style filter is the union of the single chip + the
  // panel's multi-select (deduped). Empty => no style filter (fast path).
  const effectiveStyleSlugs = [
    ...new Set([...(styleSlug ? [styleSlug] : []), ...(styleSlugs ?? [])]),
  ];
  const styleActive = effectiveStyleSlugs.length > 0;

  // Resolve the follow graph once — needed for scope filtering, the follow
  // pills, and (for discover) the affinity boost.
  const followedIds = viewer ? await listFollowedArtistIds(client, viewer) : [];
  const followedSet = new Set(followedIds);

  if (scope === "following" && followedIds.length === 0) return [];

  // Restrict-by-artist set: the following graph (following scope) intersected
  // with the artist-level filter result (city/price/books/state). When neither
  // is active this stays undefined — the default feed path is untouched/fast.
  let restrictArtistIds: string[] | undefined =
    scope === "following" ? followedIds : undefined;

  if (hasFeedArtistFilters(artistFilters)) {
    const { data, error } = await client.rpc("feed_filter_artist_ids", {
      p_lat: artistFilters!.lat ?? undefined,
      p_lng: artistFilters!.lng ?? undefined,
      p_radius_km: artistFilters!.radiusKm ?? undefined,
      p_price_min: artistFilters!.priceMinCents ?? undefined,
      p_price_max: artistFilters!.priceMaxCents ?? undefined,
      p_books_open: artistFilters!.booksOpen ?? undefined,
      p_state: artistFilters!.state ?? undefined,
    });
    if (error) throw error;
    const eligibleIds = (data ?? []) as string[];
    if (restrictArtistIds) {
      const eligible = new Set(eligibleIds);
      restrictArtistIds = restrictArtistIds.filter((id) => eligible.has(id));
    } else {
      restrictArtistIds = eligibleIds;
    }
    if (restrictArtistIds.length === 0) return [];
  }

  // Optional style filter → restrict candidate post ids up front (union across
  // every selected style's post_styles links).
  let stylePostIds: string[] | undefined;
  if (styleActive) {
    const styleRows = unwrapList(
      await client.from("styles").select("id").in("slug", effectiveStyleSlugs),
    ) as { id: string }[];
    if (styleRows.length === 0) return [];
    const links = unwrapList(
      await client
        .from("post_styles")
        .select("post_id")
        .in(
          "style_id",
          styleRows.map((s) => s.id),
        ),
    ) as { post_id: string }[];
    stylePostIds = [...new Set(links.map((l) => l.post_id))];
    if (stylePostIds.length === 0) return [];
  }

  const posts = await listCandidatePosts(client, {
    artistIds: restrictArtistIds,
    postIds: stylePostIds,
    limit: pageSize,
    offset: pageOffset,
  });

  // Flash only on page one, and only when no style filter is active (flash
  // items carry no post_styles rows, so a style filter excludes them).
  const flashItems =
    pageOffset === 0 && !styleActive
      ? await listCandidateFlashItems(client, { artistIds: restrictArtistIds, limit: 12 })
      : [];

  const artistIds = [
    ...posts.map((p) => p.artist_id),
    ...flashItems.map((f) => f.artist_id),
  ];
  const ctx = await loadHydrationContext(client, artistIds, followedSet);
  const { byPostId, styleIdsByPostId } = await loadPostStyleTags(
    client,
    posts.map((p) => p.id),
  );
  const postIds = posts.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    loadViewerLikes(client, viewer, postIds),
    loadViewerSaves(client, viewer, postIds),
  ]);

  const itemStyleIds = new Map<string, string[]>();

  const postItems: FeedPostItem[] = [];
  for (const post of posts) {
    const artist = ctx.artistsById.get(post.artist_id);
    if (!artist) continue;
    const feedArtist = toFeedArtist(artist, ctx);
    if (!feedArtist) continue;
    const key = `post:${post.id}`;
    itemStyleIds.set(key, styleIdsByPostId.get(post.id) ?? []);
    postItems.push({
      kind: "post",
      key,
      id: post.id,
      createdAt: post.created_at,
      coverUrl: post.cover_url,
      caption: post.caption,
      styleTags: byPostId.get(post.id) ?? [],
      likeCount: post.like_count,
      likedByViewer: likes.has(post.id),
      savedByViewer: saves.has(post.id),
      artist: feedArtist,
    });
  }

  const flashCards: FeedFlashItem[] = [];
  for (const flash of flashItems) {
    const artist = ctx.artistsById.get(flash.artist_id);
    if (!artist) continue;
    const feedArtist = toFeedArtist(artist, ctx);
    if (!feedArtist) continue;
    const key = `flash:${flash.id}`;
    // Flash inherits the artist's style names as lightweight placard tags.
    itemStyleIds.set(key, []);
    flashCards.push({
      kind: "flash",
      key,
      id: flash.id,
      flashSheetId: flash.flash_sheet_id,
      createdAt: flash.created_at,
      imageUrl: flash.image_url,
      title: flash.title,
      priceCents: flash.price_cents,
      isAvailable: flash.is_available,
      isRepeatable: flash.is_repeatable,
      placementSuggestion: flash.placement_suggestion,
      sizeInches: flash.size_inches,
      styleTags: (feedArtist.styles ?? []).slice(0, 2).map((name) => ({
        id: `artist-style:${name}`,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        name,
      })),
      artist: feedArtist,
    });
  }

  const merged: FeedItem[] = [...postItems, ...flashCards];

  if (scope === "discover") {
    const affinity = await getViewerAffinityStyleIds(client, followedIds);
    return rankFeedItems(merged, affinity, itemStyleIds);
  }
  // Following: pure newest-first (no affinity boost within your own follows).
  return rankFeedItems(merged, new Set(), itemStyleIds);
}
