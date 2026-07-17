/**
 * Data access for the Daily Drop surface (founder §engagement): read today's
 * personalized pick, browse the "yesterday's drops" history, and record the
 * engagement loop (seen / clicked / reacted). Selection + notification are the
 * `daily-drop` edge job's responsibility; this module is read + stamp only.
 *
 * Hydration mirrors `feed.ts`: a few narrow RLS-scoped reads assembled in JS
 * (no deep PostgREST joins), so it renders identically against the offline
 * preview harness's mock client. Rows are written by the service-role job; the
 * `daily_drops` RLS lets the owner read their rows and stamp seen/clicked/
 * reacted, which is all this module needs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { ArtistProfile, FlashItem, Post, Profile, Style } from "../types/rows";
import type { FeedArtist, FeedStyleTag } from "./feed";
import { unwrapList } from "./helpers";
import { setPostLiked, setPostSaved } from "./social";

/**
 * `daily_drops` isn't in the generated `Database` type yet (types regenerate
 * post-merge, per the repo convention — same as `image_tags` in
 * `similarWorks.ts`). One generic-client cast lets us use the normal PostgREST
 * builder against it while every other table stays strongly typed. When
 * database.ts is regenerated this cast simply becomes redundant.
 */
function dropsTable(client: InkdSupabaseClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type DropSubjectType = "post" | "flash";

/** The raw daily_drops row (not yet in generated database.ts — see similarWorks.ts). */
export interface DailyDropRow {
  id: string;
  user_id: string;
  drop_date: string;
  subject_type: DropSubjectType;
  subject_id: string;
  artist_id: string | null;
  reason: string;
  reason_style: string | null;
  is_cold_start: boolean;
  score: number | null;
  generated_at: string;
  seen_at: string | null;
  clicked_at: string | null;
  reacted_at: string | null;
}

export interface DropPostPayload {
  coverUrl: string | null;
  caption: string | null;
  likeCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  styleTags: FeedStyleTag[];
}

export interface DropFlashPayload {
  flashSheetId: string;
  imageUrl: string | null;
  title: string | null;
  priceCents: number | null;
  isAvailable: boolean;
  isRepeatable: boolean;
  placementSuggestion: string | null;
  sizeInches: number | null;
  styleTags: FeedStyleTag[];
}

/** The fully-hydrated card the UI renders. Exactly one of `post`/`flash` is set. */
export interface DailyDropCard {
  id: string;
  dropDate: string;
  reason: string;
  reasonStyle: string | null;
  isColdStart: boolean;
  seenAt: string | null;
  clickedAt: string | null;
  reactedAt: string | null;
  subjectType: DropSubjectType;
  subjectId: string;
  artist: FeedArtist | null;
  post?: DropPostPayload;
  flash?: DropFlashPayload;
}

// ---------------------------------------------------------------------------
// Row reads
// ---------------------------------------------------------------------------
async function listDropRows(
  client: InkdSupabaseClient,
  userId: string,
  opts: { date?: string; limit?: number },
): Promise<DailyDropRow[]> {
  let query = dropsTable(client)
    .from("daily_drops")
    .select("*")
    .eq("user_id", userId)
    .order("drop_date", { ascending: false });
  if (opts.date) query = query.eq("drop_date", opts.date);
  if (opts.limit) query = query.range(0, opts.limit - 1);
  return unwrapList(await query) as DailyDropRow[];
}

// ---------------------------------------------------------------------------
// Hydration (mirror of feed.ts, scoped to the small set of drop subjects)
// ---------------------------------------------------------------------------
function toFeedArtist(
  artist: ArtistProfile,
  profile: Profile | undefined,
  followed: Set<string>,
): FeedArtist | null {
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
    isFollowedByViewer: followed.has(artist.id),
  };
}

async function hydrateDrops(
  client: InkdSupabaseClient,
  rows: DailyDropRow[],
  viewerId: string,
): Promise<DailyDropCard[]> {
  if (rows.length === 0) return [];

  const postIds = rows.filter((r) => r.subject_type === "post").map((r) => r.subject_id);
  const flashIds = rows.filter((r) => r.subject_type === "flash").map((r) => r.subject_id);

  const [postsRaw, flashRaw] = await Promise.all([
    postIds.length
      ? (unwrapList(await client.from("posts").select("*").in("id", postIds)) as Post[])
      : Promise.resolve([]),
    flashIds.length
      ? (unwrapList(await client.from("flash_items").select("*").in("id", flashIds)) as FlashItem[])
      : Promise.resolve([]),
  ]);
  const postsById = new Map(postsRaw.map((p) => [p.id, p]));
  const flashById = new Map(flashRaw.map((f) => [f.id, f]));

  const artistIds = [...new Set(rows.map((r) => r.artist_id).filter((x): x is string => !!x))];
  const artists = artistIds.length
    ? (unwrapList(await client.from("artist_profiles").select("*").in("id", artistIds)) as ArtistProfile[])
    : [];
  const artistsById = new Map(artists.map((a) => [a.id, a]));
  const profileIds = [...new Set(artists.map((a) => a.profile_id))];
  const profiles = profileIds.length
    ? (unwrapList(await client.from("profiles").select("*").in("id", profileIds)) as Profile[])
    : [];
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const followed = new Set(
    (
      unwrapList(
        await client.from("follows").select("artist_id").eq("follower_id", viewerId),
      ) as { artist_id: string }[]
    ).map((r) => r.artist_id),
  );

  const styleTagsByPost = await loadPostStyleTags(client, postIds);
  const [likes, saves] = await Promise.all([
    loadViewerPostState(client, "post_likes", viewerId, postIds),
    loadViewerPostState(client, "saved_posts", viewerId, postIds),
  ]);

  const cards: DailyDropCard[] = [];
  for (const row of rows) {
    const artist = row.artist_id ? artistsById.get(row.artist_id) : undefined;
    const feedArtist = artist
      ? toFeedArtist(artist, profilesById.get(artist.profile_id), followed)
      : null;

    const base = {
      id: row.id,
      dropDate: row.drop_date,
      reason: row.reason,
      reasonStyle: row.reason_style,
      isColdStart: row.is_cold_start,
      seenAt: row.seen_at,
      clickedAt: row.clicked_at,
      reactedAt: row.reacted_at,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      artist: feedArtist,
    };

    if (row.subject_type === "post") {
      const post = postsById.get(row.subject_id);
      if (!post) continue;
      cards.push({
        ...base,
        post: {
          coverUrl: post.cover_url,
          caption: post.caption,
          likeCount: post.like_count,
          likedByViewer: likes.has(post.id),
          savedByViewer: saves.has(post.id),
          styleTags: styleTagsByPost.get(post.id) ?? [],
        },
      });
    } else {
      const flash = flashById.get(row.subject_id);
      if (!flash) continue;
      cards.push({
        ...base,
        flash: {
          flashSheetId: flash.flash_sheet_id,
          imageUrl: flash.image_url,
          title: flash.title,
          priceCents: flash.price_cents,
          isAvailable: flash.is_available,
          isRepeatable: flash.is_repeatable,
          placementSuggestion: flash.placement_suggestion,
          sizeInches: flash.size_inches,
          styleTags: (feedArtist?.styles ?? []).slice(0, 2).map((name) => ({
            id: `artist-style:${name}`,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            name,
          })),
        },
      });
    }
  }
  return cards;
}

async function loadPostStyleTags(
  client: InkdSupabaseClient,
  postIds: string[],
): Promise<Map<string, FeedStyleTag[]>> {
  const byPost = new Map<string, FeedStyleTag[]>();
  if (postIds.length === 0) return byPost;
  const links = unwrapList(
    await client.from("post_styles").select("post_id, style_id").in("post_id", postIds),
  ) as { post_id: string; style_id: string }[];
  const styleIds = [...new Set(links.map((l) => l.style_id))];
  const styles = styleIds.length
    ? (unwrapList(await client.from("styles").select("*").in("id", styleIds)) as Style[])
    : [];
  const styleById = new Map(styles.map((s) => [s.id, s]));
  for (const link of links) {
    const style = styleById.get(link.style_id);
    if (!style) continue;
    const tag: FeedStyleTag = { id: style.id, slug: style.slug, name: style.name };
    const arr = byPost.get(link.post_id) ?? [];
    arr.push(tag);
    byPost.set(link.post_id, arr);
  }
  return byPost;
}

async function loadViewerPostState(
  client: InkdSupabaseClient,
  table: "post_likes" | "saved_posts",
  viewerId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = unwrapList(
    await client.from(table).select("post_id").eq("profile_id", viewerId).in("post_id", postIds),
  ) as { post_id: string }[];
  return new Set(rows.map((r) => r.post_id));
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------
/** Today's drop for the user (or a specific date), hydrated. Null when none. */
export async function getTodayDrop(
  client: InkdSupabaseClient,
  userId: string,
  opts: { date?: string } = {},
): Promise<DailyDropCard | null> {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const rows = await listDropRows(client, userId, { date, limit: 1 });
  if (rows.length === 0) return null;
  const cards = await hydrateDrops(client, rows, userId);
  return cards[0] ?? null;
}

/**
 * On-demand generation: ask the `daily-drop` edge function to generate the
 * calling user's drop for TODAY if it doesn't exist yet. The function runs in
 * "self" mode — it verifies the forwarded user JWT and generates ONLY that
 * user's drop, idempotently (a no-op if today's drop already exists). This is
 * what makes the drop appear the moment a user opens the app, rather than only
 * after the once-a-day cron tick. Best-effort: any failure is swallowed so the
 * surface degrades to "empty" (and the cron still fills it later) — never errors.
 */
export async function ensureTodayDrop(client: InkdSupabaseClient): Promise<boolean> {
  try {
    const { error } = await (
      client as unknown as {
        functions: {
          invoke: (
            fn: string,
            opts: { body: unknown },
          ) => PromiseLike<{ data: unknown; error: unknown }>;
        };
      }
    ).functions.invoke("daily-drop", { body: { mode: "self" } });
    return !error;
  } catch {
    return false;
  }
}

/** Recent drops (newest first) for the "yesterday's drops" history strip. */
export async function getDropHistory(
  client: InkdSupabaseClient,
  userId: string,
  opts: { limit?: number } = {},
): Promise<DailyDropCard[]> {
  const rows = await listDropRows(client, userId, { limit: opts.limit ?? 14 });
  return hydrateDrops(client, rows, userId);
}

// ---------------------------------------------------------------------------
// Engagement loop
// ---------------------------------------------------------------------------
export async function markDropSeen(client: InkdSupabaseClient, dropId: string): Promise<void> {
  const { error } = await dropsTable(client)
    .from("daily_drops")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", dropId)
    .is("seen_at", null);
  if (error) throw error;
}

export async function markDropClicked(client: InkdSupabaseClient, dropId: string): Promise<void> {
  const { error } = await dropsTable(client)
    .from("daily_drops")
    .update({ clicked_at: new Date().toISOString() })
    .eq("id", dropId)
    .is("clicked_at", null);
  if (error) throw error;
}

export const reactToDropSchema = z.object({
  dropId: z.string().min(1),
  profileId: z.string().min(1),
  postId: z.string().min(1),
  action: z.enum(["like", "save"]),
  on: z.boolean(),
});
export type ReactToDropParams = z.input<typeof reactToDropSchema>;

/**
 * React to a post drop (like/save) — the reaction feeds straight back into the
 * user's `user_style_affinity` (post_likes / saved_posts are affinity signals),
 * closing the engagement loop. Also stamps `reacted_at` so the surface can show
 * the drop was acted on. No-op for flash drops (no post to like/save).
 */
export async function reactToDrop(
  client: InkdSupabaseClient,
  params: ReactToDropParams,
): Promise<void> {
  const p = reactToDropSchema.parse(params);
  if (p.action === "like") await setPostLiked(client, p.profileId, p.postId, p.on);
  else await setPostSaved(client, p.profileId, p.postId, p.on);
  if (p.on) {
    const { error } = await dropsTable(client)
      .from("daily_drops")
      .update({ reacted_at: new Date().toISOString() })
      .eq("id", p.dropId)
      .is("reacted_at", null);
    if (error) throw error;
  }
}
