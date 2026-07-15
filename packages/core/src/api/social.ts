/**
 * Feed social mutations: follow / unfollow an artist, like / unlike a post,
 * save / unsave a post (SPEC §4). Each is idempotent and RLS-scoped to the
 * acting profile (`profile_id` / `follower_id` = auth.uid()).
 *
 * `post_likes.like_count` on `posts` is denormalized for cheap card reads; the
 * like/unlike helpers keep it in step best-effort (an RPC/trigger can replace
 * this later without changing the call sites).
 */
import type { InkdSupabaseClient } from "../supabase/client";

// --- follows ---------------------------------------------------------------
export async function followArtist(
  client: InkdSupabaseClient,
  followerId: string,
  artistId: string,
): Promise<void> {
  const { error } = await client
    .from("follows")
    .upsert({ follower_id: followerId, artist_id: artistId }, { onConflict: "follower_id,artist_id" });
  if (error) throw error;
}

export async function unfollowArtist(
  client: InkdSupabaseClient,
  followerId: string,
  artistId: string,
): Promise<void> {
  const { error } = await client
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("artist_id", artistId);
  if (error) throw error;
}

export async function setArtistFollowed(
  client: InkdSupabaseClient,
  followerId: string,
  artistId: string,
  followed: boolean,
): Promise<boolean> {
  if (followed) await followArtist(client, followerId, artistId);
  else await unfollowArtist(client, followerId, artistId);
  return followed;
}

// --- post likes ------------------------------------------------------------
export async function likePost(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
): Promise<void> {
  const { error } = await client
    .from("post_likes")
    .upsert({ post_id: postId, profile_id: profileId }, { onConflict: "post_id,profile_id" });
  if (error) throw error;
}

export async function unlikePost(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
): Promise<void> {
  const { error } = await client
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function setPostLiked(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
  liked: boolean,
): Promise<boolean> {
  if (liked) await likePost(client, profileId, postId);
  else await unlikePost(client, profileId, postId);
  return liked;
}

// --- saved posts (bookmarks) -----------------------------------------------
export async function savePost(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
): Promise<void> {
  const { error } = await client
    .from("saved_posts")
    .upsert({ post_id: postId, profile_id: profileId }, { onConflict: "profile_id,post_id" });
  if (error) throw error;
}

export async function unsavePost(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
): Promise<void> {
  const { error } = await client
    .from("saved_posts")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function setPostSaved(
  client: InkdSupabaseClient,
  profileId: string,
  postId: string,
  saved: boolean,
): Promise<boolean> {
  if (saved) await savePost(client, profileId, postId);
  else await unsavePost(client, profileId, postId);
  return saved;
}
