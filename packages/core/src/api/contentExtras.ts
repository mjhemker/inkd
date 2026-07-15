/**
 * Extensions to `./content.ts` (update/delete/reorder for posts,
 * portfolio_pieces, flash_sheets, flash_items) — split into a new file per
 * the "extensions in NEW files" rule rather than editing the existing
 * content module.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  Post,
  PortfolioPiece,
  FlashSheet,
  FlashItem,
} from "../types/rows";
import { unwrap, unwrapMaybe } from "./helpers";

// --- posts -------------------------------------------------------------
const postUpdateFields = z.object({
  caption: z.string().max(4000).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_public: z.boolean().optional(),
});

export async function updatePost(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof postUpdateFields>,
): Promise<Post> {
  const fields = postUpdateFields.parse(patch);
  return unwrap(
    await client.from("posts").update(fields).eq("id", id).select("*").single(),
  );
}

export async function getPostById(
  client: InkdSupabaseClient,
  id: string,
): Promise<Post | null> {
  return unwrapMaybe(
    await client.from("posts").select("*").eq("id", id).maybeSingle(),
  );
}

/** Style ids tagged on a post (normalized `post_styles` join). */
export async function listPostStyleIds(
  client: InkdSupabaseClient,
  postId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("post_styles")
    .select("style_id")
    .eq("post_id", postId);
  if (error) throw error;
  return (data ?? []).map((row) => row.style_id);
}

/** Replace a post's style tags with the given set (delete + re-insert). */
export async function setPostStyles(
  client: InkdSupabaseClient,
  postId: string,
  artistId: string,
  styleIds: string[],
): Promise<void> {
  const { error: delError } = await client
    .from("post_styles")
    .delete()
    .eq("post_id", postId);
  if (delError) throw delError;
  if (styleIds.length === 0) return;
  const { error: insError } = await client
    .from("post_styles")
    .insert(styleIds.map((styleId) => ({ post_id: postId, style_id: styleId, artist_id: artistId })));
  if (insError) throw insError;
}

// --- portfolio_pieces ----------------------------------------------------
const portfolioUpdateFields = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  placement: z.string().max(120).nullable().optional(),
  style_tags: z.array(z.string()).optional(),
  is_healed: z.boolean().nullable().optional(),
  is_public: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function updatePortfolioPiece(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof portfolioUpdateFields>,
): Promise<PortfolioPiece> {
  const fields = portfolioUpdateFields.parse(patch);
  return unwrap(
    await client
      .from("portfolio_pieces")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/**
 * Persist a new display order for an artist's portfolio (and implicitly the
 * "cover" piece — the first id in `orderedIds` becomes `sort_order: 0`, which
 * is what the public profile grid / cover treats as the featured piece).
 */
export async function reorderPortfolioPieces(
  client: InkdSupabaseClient,
  artistId: string,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      client
        .from("portfolio_pieces")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("artist_id", artistId),
    ),
  );
}

/** Move a single piece to sort_order 0 (the public-profile cover slot) and
 * push everything else down by one, preserving relative order. */
export async function setPortfolioCover(
  client: InkdSupabaseClient,
  artistId: string,
  pieceId: string,
  currentOrderedIds: string[],
): Promise<void> {
  const rest = currentOrderedIds.filter((id) => id !== pieceId);
  await reorderPortfolioPieces(client, artistId, [pieceId, ...rest]);
}

// --- flash sheets ----------------------------------------------------------
const flashSheetUpdateFields = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_public: z.boolean().optional(),
});

export async function updateFlashSheet(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof flashSheetUpdateFields>,
): Promise<FlashSheet> {
  const fields = flashSheetUpdateFields.parse(patch);
  return unwrap(
    await client
      .from("flash_sheets")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

export async function deleteFlashSheet(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("flash_sheets").delete().eq("id", id);
  if (error) throw error;
}

// --- flash items -----------------------------------------------------------
const flashItemUpdateFields = z.object({
  title: z.string().max(200).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  is_repeatable: z.boolean().optional(),
  is_available: z.boolean().optional(),
  placement_suggestion: z.string().max(120).nullable().optional(),
  size_inches: z.number().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export async function updateFlashItem(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof flashItemUpdateFields>,
): Promise<FlashItem> {
  const fields = flashItemUpdateFields.parse(patch);
  return unwrap(
    await client
      .from("flash_items")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

export async function deleteFlashItem(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("flash_items").delete().eq("id", id);
  if (error) throw error;
}

/** Convenience toggle for the artist's "claimed / available" switch. */
export async function setFlashItemAvailability(
  client: InkdSupabaseClient,
  id: string,
  isAvailable: boolean,
): Promise<FlashItem> {
  return updateFlashItem(client, id, { is_available: isAvailable });
}
